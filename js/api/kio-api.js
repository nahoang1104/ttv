/* ============================================================================
 * KIO SERVER ADAPTER - CHUNKED PAYLOAD v2
 *
 * Dùng đúng API mẫu của công ty:
 *   - getKrudList(...) từ https://kio.dvqt.vn/list.js
 *   - sendFormDataKRUD(...) / krud(...) từ https://kio.dvqt.vn/krud.js
 *
 * KHÔNG thay đổi business logic. Các module vẫn dùng DB.* như cũ.
 *
 * Vì cột `payload` trên server có thể là VARCHAR ngắn, một object nghiệp vụ
 * lớn sẽ bị lỗi MySQL 1406 (Data too long). Adapter này chia một record JSON
 * thành nhiều dòng payload nhỏ, rồi tự ghép lại khi đọc.
 *
 * Server chỉ cần mỗi bảng có tối thiểu:
 *   id      : khóa chính tự tăng
 *   payload : VARCHAR/TEXT (VARCHAR ngắn vẫn dùng được)
 * ========================================================================== */
const KioStore = (() => {
  const PAGE_SIZE = 1000;
  const FORM_ID = '__kio_payload_form__';
  // 120 ký tự giúp payload hoàn chỉnh vẫn an toàn với VARCHAR(255).
  const CHUNK_SIZE = 120;
  const FORMAT_VERSION = 2;
  // [PERFORMANCE] Giới hạn số request ghi/xóa chạy song song. Chunk của cùng
  // một record độc lập (được ghép lại theo chỉ số i), nên có thể gửi theo nhóm
  // nhỏ mà không thay đổi dữ liệu nghiệp vụ. Không tăng quá cao để tránh quá tải KIO.
  const WRITE_CONCURRENCY = 3;

  // [KIO STABILITY] list.js của KIO dùng AbortController nội bộ. Khi nhiều
  // module (Auth/Purchase/Inventory/CRM) gọi getKrudList song song, request
  // trước có thể bị abort ('signal is aborted without reason'). Xếp hàng riêng
  // các request LIST để tránh chúng tự hủy nhau; không thay đổi nghiệp vụ.
  let listRequestChain = Promise.resolve();

  // [PERFORMANCE] Cache kết quả đọc vật lý theo bảng trong một khoảng ngắn.
  // Nhiều màn hình có thể cần cùng một bảng (ví dụ inventory/products/customers);
  // không gọi lại list.php nếu vừa đọc xong. Cache bị vô hiệu ngay khi có ghi/xóa.
  const ROW_CACHE_TTL = 30 * 1000;
  const rowCache = new Map();
  const rowInflight = new Map();
  const rowEpoch = new Map();

  function listCacheKey(table, where) {
    if (where && where.length) return table + '::' + JSON.stringify(where);
    return table;
  }

  function keyWhere(key) {
    return [{ field: 'payload', operator: 'LIKE', value: '{"v":2,"k":"' + String(key) + '"%' }];
  }

  function listRowsByKey(table, key) {
    return listRows(table, { force: true, where: keyWhere(key) });
  }

  function rememberDelta(table, key, data) {
    const st = deltaState.get(table);
    if (st && data) st.items.set(String(key), data);
  }

  function invalidateTable(table) {
    rowCache.delete(table);
    Array.from(rowCache.keys()).forEach(function (k) {
      if (k === table || String(k).indexOf(table + '::') === 0) rowCache.delete(k);
    });
    rowEpoch.set(table, (rowEpoch.get(table) || 0) + 1);
  }

  function queuedGetKrudList(args) {
    const task = () => getKrudList(args);
    const current = listRequestChain.catch(() => {}).then(task);
    listRequestChain = current.catch(() => {});
    return current;
  }

  function assertReady() {
    if (typeof getKrudList !== 'function') {
      throw new Error('Chưa tải https://kio.dvqt.vn/list.js');
    }
    if (typeof sendFormDataKRUD !== 'function' || typeof krud !== 'function') {
      throw new Error('Chưa tải https://kio.dvqt.vn/krud.js');
    }
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function keyOf(item, index = 0) {
    if (item && typeof item === 'object') {
      const candidates = [
        item.id, item.code, item.key, item.lotId, item.lotNumber,
        item.transactionId, item.transferId, item.countId, item.requestId,
        item.inspectionId, item.moveId,
      ];
      const found = candidates.find(v => v !== undefined && v !== null && String(v) !== '');
      if (found !== undefined) return String(found);
    }
    return `ROW-${index + 1}`;
  }

  function splitText(text, size = CHUNK_SIZE) {
    const out = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out.length ? out : [''];
  }

  function encodeItem(item, index) {
    const key = keyOf(item, index);
    const raw = JSON.stringify(clonePlain(item));
    const chunks = splitText(raw);
    return {
      key,
      raw,
      payloads: chunks.map((data, i) => JSON.stringify({
        v: FORMAT_VERSION,
        k: key,
        i,
        n: chunks.length,
        d: data,
      })),
    };
  }

  function parsePayload(raw) {
    if (raw == null || raw === '') return null;
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); }
      catch (_) { return null; }
    }
    return parsed && typeof parsed === 'object' ? parsed : null;
  }

  async function listRows(table, { force = false, where } = {}) {
    assertReady();

    const filter = Array.isArray(where) ? where : [];
    const cacheKey = listCacheKey(table, filter);
    const now = Date.now();
    const ttl = force ? 0 : ROW_CACHE_TTL;
    const cached = rowCache.get(cacheKey);
    if (ttl > 0 && cached && (now - cached.at) < ttl) {
      return cached.rows.slice();
    }

    // Cùng bảng+điều kiện đang đọc: dùng chung Promise, không tạo list.php thứ hai.
    if (rowInflight.has(cacheKey)) {
      const pending = rowInflight.get(cacheKey);
      if (!force) return (await pending).slice();
      await pending.catch(() => {});
    }

    if (force) {
      rowCache.delete(cacheKey);
      if (!filter.length) rowEpoch.set(table, (rowEpoch.get(table) || 0) + 1);
    }
    const epoch = rowEpoch.get(table) || 0;

    const job = (async () => {
      const out = [];
      let page = 1;

      while (true) {
        let res;
        let lastErr;
        // KIO đôi lúc abort request khi server phản hồi chậm. Retry đúng 1 lần
        // sau một khoảng ngắn; không loop vô hạn làm trang càng chậm.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            res = await queuedGetKrudList({
              table,
              page,
              limit: PAGE_SIZE,
              sort: { id: 'ASC' },
              where: filter,
            });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt === 0 && /abort/i.test(String(err?.message || err))) {
              await new Promise(resolve => setTimeout(resolve, 180));
              continue;
            }
            throw err;
          }
        }

        if (lastErr) throw lastErr;
        if (!res || !res.success) {
          throw new Error(res?.error || `Không đọc được bảng ${table}`);
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        out.push(...rows);
        if (rows.length < PAGE_SIZE || out.length >= Number(res.total || 0)) break;
        page += 1;
      }

      if ((rowEpoch.get(table) || 0) === epoch) {
        rowCache.set(cacheKey, { at: Date.now(), rows: out.slice() });
      }
      return out;
    })();

    rowInflight.set(cacheKey, job);
    try {
      return (await job).slice();
    } finally {
      if (rowInflight.get(cacheKey) === job) rowInflight.delete(cacheKey);
    }
  }

  function groupRemoteRows(rows) {
    const groups = new Map();

    rows.forEach(row => {
      const parsed = parsePayload(row.payload);
      if (!parsed) return;

      // Format chunk v2.
      if (parsed.v === FORMAT_VERSION && parsed.k != null && Number.isInteger(Number(parsed.i))) {
        const key = String(parsed.k);
        if (!groups.has(key)) groups.set(key, { key, rows: [], parts: [], legacy: false });
        const g = groups.get(key);
        g.rows.push(row);
        g.parts.push({ i: Number(parsed.i), n: Number(parsed.n || 0), d: String(parsed.d ?? '') });
        return;
      }

      // Hỗ trợ payload cũ { key, data } từ adapter v1.
      if (Object.prototype.hasOwnProperty.call(parsed, 'data')) {
        const key = String(parsed.key ?? keyOf(parsed.data, 0));
        if (!groups.has(key)) groups.set(key, { key, rows: [], parts: [], legacy: true, legacyData: parsed.data });
        const g = groups.get(key);
        g.rows.push(row);
        g.legacy = true;
        g.legacyData = parsed.data;
        return;
      }

      // Hỗ trợ trường hợp trước đó payload lưu thẳng object.
      const key = keyOf(parsed, 0);
      if (!groups.has(key)) groups.set(key, { key, rows: [], parts: [], legacy: true, legacyData: parsed });
      const g = groups.get(key);
      g.rows.push(row);
      g.legacy = true;
      g.legacyData = parsed;
    });

    for (const g of groups.values()) {
      if (g.legacy) {
        try { g.raw = JSON.stringify(g.legacyData); } catch (_) { g.raw = ''; }
        g.data = g.legacyData;
        continue;
      }
      g.parts.sort((a, b) => a.i - b.i);
      const raw = g.parts.map(p => p.d).join('');
      g.raw = raw;
      try { g.data = JSON.parse(raw); }
      catch (_) { g.data = null; }
    }

    return groups;
  }

  async function listCollection(table, opts = {}) {
    if (opts.delta) return listCollectionDelta(table, opts);
    const rows = await listRows(table, opts);
    const groups = groupRemoteRows(rows);
    return [...groups.values()].map(g => g.data).filter(Boolean);
  }

  // Gom bản ghi nghiệp vụ giữa các lần đọc: lần đầu list cả bảng, sau đó chỉ lấy
  // dòng vật lý id > max (KIO where trên cột id). Cột payload là JSON cắt 120 ký tự
  // nên không lọc được recipient_id phía server cho đủ chunk.
  const deltaState = new Map();

  function mergeDelta(st, rows) {
    (rows || []).forEach((row) => {
      const nid = Number(row && row.id);
      if (isFinite(nid) && nid > st.maxId) st.maxId = nid;
    });
    const groups = groupRemoteRows(rows || []);
    groups.forEach((g, key) => {
      if (g.legacy) {
        if (g.data) st.items.set(key, g.data);
        st.parts.delete(key);
        return;
      }
      const has0 = (g.parts || []).some((p) => p.i === 0);
      let acc = st.parts.get(key) || { parts: [] };
      if (has0 && (st.items.has(key) || acc.parts.length)) acc = { parts: [] };
      const byI = new Map();
      acc.parts.forEach((p) => byI.set(p.i, p));
      (g.parts || []).forEach((p) => byI.set(p.i, p));
      const parts = [...byI.values()].sort((a, b) => a.i - b.i);
      let n = 0;
      parts.forEach((p) => { if (p.n) n = Number(p.n) || n; });
      if (n && parts.length >= n) {
        try {
          const data = JSON.parse(parts.map((p) => p.d).join(''));
          if (data) st.items.set(key, data);
        } catch (_) {}
        st.parts.delete(key);
      } else {
        st.parts.set(key, { parts });
      }
    });
  }

  async function listCollectionDelta(table, opts = {}) {
    let st = deltaState.get(table);
    if (!st || opts.full) {
      st = { maxId: 0, items: new Map(), parts: new Map() };
      deltaState.set(table, st);
    }
    var overlap = 32;
    var cursor = st.maxId > overlap ? st.maxId - overlap : 0;
    const where = cursor > 0
      ? [{ field: 'id', operator: '>', value: cursor }]
      : [];
    const rows = await listRows(table, { force: true, where });
    mergeDelta(st, rows);
    return [...st.items.values()];
  }

  let payloadFormSeq = 0;

  // Mỗi request ghi dùng form riêng để các request chunk có thể chạy song song
  // mà không ghi đè giá trị textarea của nhau. FORM_ID cũ vẫn giữ làm prefix
  // để không ảnh hưởng cách server nhận FormData.
  function createPayloadForm(payloadText) {
    const form = document.createElement('form');
    form.id = `${FORM_ID}_${++payloadFormSeq}`;
    form.style.display = 'none';
    form.innerHTML = '<textarea class="data-element" name="payload"></textarea>';
    form.querySelector('[name="payload"]').value = payloadText;
    document.body.appendChild(form);
    return form;
  }

  async function runLimited(items, limit, worker) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];
    const results = new Array(list.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(Math.max(1, limit), list.length) }, async () => {
      while (true) {
        const index = next++;
        if (index >= list.length) return;
        results[index] = await worker(list[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  }

  async function writePayload(action, table, recordId, payloadText) {
    assertReady();
    const form = createPayloadForm(payloadText);
    try {
      const res = await sendFormDataKRUD(action, table, recordId || null, `#${form.id}`);
      if (!res || !res.success) {
        throw new Error(res?.error || `${action} thất bại ở bảng ${table}`);
      }
      invalidateTable(table);
      return res;
    } finally {
      form.remove();
    }
  }

  async function deleteRows(table, rows) {
    await runLimited(rows || [], WRITE_CONCURRENCY, async (row) => {
      const res = await krud('delete', table, {}, row.id);
      if (!res || !res.success) {
        throw new Error(res?.error || `Không xóa được record ${row.id} ở ${table}`);
      }
      return res;
    });
    if ((rows || []).length) invalidateTable(table);
  }

  async function insertEncoded(table, encoded) {
    // [KIO RACE FIX] Các chunk thuộc CÙNG một record phải ghi tuần tự.
    // Nếu gửi đồng thời vào một bảng vừa được tạo, backend KIO có thể để nhiều
    // request cùng rơi vào nhánh CREATE TABLE và phát sinh MySQL 1050
    // "Table already exists". Ghi tuần tự vẫn giữ nguyên dữ liệu nghiệp vụ
    // và loại bỏ race condition này.
    for (const payloadText of encoded.payloads) {
      try {
        await writePayload('insert', table, null, payloadText);
      } catch (err) {
        // Trường hợp một client/request khác vừa tạo bảng ở đúng thời điểm này,
        // đợi ngắn rồi thử lại đúng 1 lần. Không retry các lỗi khác.
        if (/SQLSTATE\[42S01\]|1050|already exists/i.test(String(err?.message || err))) {
          await new Promise(resolve => setTimeout(resolve, 180));
          await writePayload('insert', table, null, payloadText);
        } else {
          throw err;
        }
      }
    }
  }

  // [PERFORMANCE] Append-only cho dữ liệu có khóa luôn mới (đặc biệt Audit).
  // Không đọc toàn bộ bảng trước khi insert, tránh audit log càng lớn càng chậm.
  async function appendCollection(table, items) {
    assertReady();
    const local = (Array.isArray(items) ? items : []).map(encodeItem);
    for (const encoded of local) await insertEncoded(table, encoded);
    invalidateTable(table);
    return true;
  }

  function missingRemoteTable(err) {
    return /42S02|1146|doesn'?t exist|does not exist|unknown table|Không đọc được bảng/i.test(String((err && err.message) || err || ''));
  }

  // Ghi 1–n bản ghi: chỉ LIKE đúng khóa, không list cả bảng.
  async function upsertItems(table, items) {
    assertReady();
    const local = (Array.isArray(items) ? items : []).map(encodeItem);
    for (const encoded of local) {
      let remoteRows = [];
      try {
        remoteRows = await listRowsByKey(table, encoded.key);
      } catch (err) {
        if (!missingRemoteTable(err)) throw err;
        await insertEncoded(table, encoded);
        try { rememberDelta(table, encoded.key, JSON.parse(encoded.raw)); } catch (_) {}
        continue;
      }
      const remote = groupRemoteRows(remoteRows).get(encoded.key);
      if (!remote) {
        await insertEncoded(table, encoded);
      } else if (remote.raw !== encoded.raw || remote.legacy) {
        await deleteRows(table, remote.rows);
        await insertEncoded(table, encoded);
      }
      try { rememberDelta(table, encoded.key, JSON.parse(encoded.raw)); } catch (_) {}
    }
    return true;
  }

  // Đồng bộ theo key nghiệp vụ: thêm record thiếu, thay record thay đổi;
  // không tự xóa record server chỉ vì frontend chưa có record đó.
  async function syncCollection(table, items) {
    return upsertItems(table, items);
  }

  // [DATA CLEANUP] Xóa chính xác một hoặc nhiều record theo khóa nghiệp vụ.
  async function deleteKeys(table, keys) {
    assertReady();
    const wanted = [...new Set((Array.isArray(keys) ? keys : [keys]).map(String).filter(Boolean))];
    if (!wanted.length) return true;
    if (wanted.length > 8) {
      const rows = await listRows(table);
      const groups = groupRemoteRows(rows);
      for (const key of wanted) {
        const group = groups.get(String(key));
        if (group) await deleteRows(table, group.rows);
      }
    } else {
      for (const key of wanted) {
        let rows = [];
        try { rows = await listRowsByKey(table, key); } catch (err) {
          if (missingRemoteTable(err)) continue;
          throw err;
        }
        const group = groupRemoteRows(rows).get(key);
        if (group) await deleteRows(table, group.rows);
      }
    }
    const st = deltaState.get(table);
    if (st) wanted.forEach((k) => { st.items.delete(k); st.parts.delete(k); });
    return true;
  }

  // [DATA REPAIR] Thay toàn bộ collection bằng snapshot đã chuẩn hóa.
  // Chỉ dùng khi đã phát hiện dữ liệu vật lý trùng/lỗi; không dùng cho sync thường ngày.
  async function replaceCollection(table, items) {
    assertReady();
    const rows = await listRows(table, { force: true });
    if (rows.length) await deleteRows(table, rows);
    const local = (Array.isArray(items) ? items : []).map(encodeItem);
    for (const encoded of local) await insertEncoded(table, encoded);
    deltaState.delete(table);
    invalidateTable(table);
    return true;
  }

  async function saveSingleton(table, key, data) {
    return syncCollection(table, [{ id: key, ...clonePlain(data) }]);
  }

  async function loadSingleton(table, key) {
    const rows = await listCollection(table, { where: keyWhere(key), force: true });
    return rows.find(x => String(x?.id) === String(key)) || null;
  }

  return {
    listRows,
    listCollection,
    syncCollection,
    upsertItems,
    appendCollection,
    deleteKeys,
    replaceCollection,
    saveSingleton,
    loadSingleton,
    invalidateTable,
  };
})();
