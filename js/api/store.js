/* store.js — CRUD: driver local (IndexedDB) hoặc KIO (bảng ttv_…). */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var DB_NAME = 'tingtingvac_db';
  var DB_VERSION = 1;
  var TABLES = [
    'users','addresses','services','pricing_config','orders','order_media','quotes',
    'wallet_transactions','payment_methods','coupons','user_coupons','notification_settings',
    'reviews','faqs','policies','banners','vendors','staff','sessions','order_events',
    'vendor_documents','vendor_transactions','withdrawals','reports','broadcasts','audit_logs',
    'notifications','app_settings','__meta'
  ];
  var APPEND_TABLES = { audit_logs: true, order_events: true };

  function cfg() { return window.TTV_CONFIG || {}; }
  function isKio() { return cfg().mode === 'kio'; }
  function prefix() {
    var p = String(cfg().prefix || 'ttv_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!p) p = 'ttv_';
    if (p.charAt(p.length - 1) !== '_') p += '_';
    return p;
  }
  function validTable(table) {
    if (TABLES.indexOf(table) < 0) throw new Error('Bảng không hợp lệ: ' + table);
    return table;
  }
  /* Tên bảng KIO: ttv_ + tên (chữ thường, không dấu). __meta → ttv_meta. */
  function remoteName(table) {
    validTable(table);
    var slug = table === '__meta' ? 'meta' : String(table).toLowerCase();
    return prefix() + slug;
  }
  function kioApi() {
    if (typeof KioStore === 'undefined' || !KioStore) throw new Error('Chưa có KioStore. Hãy nạp js/api/kio-api.js.');
    return KioStore;
  }
  function missingTable(err) {
    var m = String((err && err.message) || err || '');
    return /42S02|1146|doesn'?t exist|does not exist|unknown table|no such table|không đọc được bảng/i.test(m);
  }

  function applyQuery(rows, criteria) {
    criteria = criteria || {};
    if (typeof criteria === 'function') return rows.filter(criteria);
    var where = criteria.where || criteria;
    var keys = Object.keys(where);
    return rows.filter(function (row) {
      return keys.every(function (key) {
        if (key === 'limit' || key === 'offset' || key === 'orderBy' || key === 'direction') return true;
        var expected = where[key];
        if (typeof expected === 'function') return expected(row[key], row);
        if (Array.isArray(expected)) return expected.indexOf(row[key]) >= 0;
        return row[key] === expected;
      });
    }).sort(function (a, b) {
      if (!where.orderBy) return 0;
      var x = a[where.orderBy], y = b[where.orderBy];
      return (x < y ? -1 : x > y ? 1 : 0) * (where.direction === 'desc' ? -1 : 1);
    }).slice(Number(where.offset) || 0, where.limit == null ? undefined : (Number(where.offset) || 0) + Math.max(0, Number(where.limit) || 0));
  }
  function copyRecord(record) {
    if (!record || typeof record !== 'object') throw new TypeError('Bản ghi phải là object.');
    var copy = Object.assign({}, record);
    if (copy.id === undefined || copy.id === null || String(copy.id) === '') throw new Error('Bản ghi phải có id.');
    copy.id = String(copy.id);
    return copy;
  }

  var dbPromise;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('Trình duyệt không hỗ trợ IndexedDB.')); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        TABLES.forEach(function (table) {
          if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
        });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { dbPromise = null; reject(request.error || new Error('Không mở được cơ sở dữ liệu.')); };
      request.onblocked = function () { reject(new Error('Cơ sở dữ liệu đang bị chặn bởi tab khác.')); };
    });
    return dbPromise;
  }
  function run(table, mode, action) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(table, mode), store = tx.objectStore(table), request;
        try { request = action(store); } catch (e) { reject(e); return; }
        var result;
        if (request) { request.onsuccess = function () { result = request.result; }; request.onerror = function () { reject(request.error); }; }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = tx.onabort = function () { reject(tx.error || (request && request.error) || new Error('Thao tác IndexedDB thất bại.')); };
      });
    });
  }

  var localStore = {
    dbName: DB_NAME,
    driver: 'local',
    tables: TABLES.filter(function (t) { return t !== '__meta'; }),
    remoteName: remoteName,
    ready: openDb,
    list: function (table) { validTable(table); return run(table, 'readonly', function (s) { return s.getAll(); }).then(function (rows) { return rows || []; }); },
    get: function (table, id) { validTable(table); return run(table, 'readonly', function (s) { return s.get(String(id)); }).then(function (row) { return row || null; }); },
    put: function (table, record) {
      validTable(table);
      var copy = copyRecord(record);
      return run(table, 'readwrite', function (s) { return s.put(copy); }).then(function () { return copy; });
    },
    putAll: function (table, records) {
      validTable(table);
      records = Array.isArray(records) ? records : [];
      return records.reduce(function (chain, record) {
        return chain.then(function () { return localStore.put(table, record); });
      }, Promise.resolve()).then(function () { return records.length; });
    },
    remove: function (table, id) { validTable(table); return run(table, 'readwrite', function (s) { return s.delete(String(id)); }).then(function () { return true; }); },
    query: function (table, criteria) {
      validTable(table);
      return localStore.list(table).then(function (rows) { return applyQuery(rows || [], criteria); });
    },
    invalidate: function () {},
    clear: function (table) { validTable(table); return run(table, 'readwrite', function (s) { return s.clear(); }).then(function () { return true; }); },
    count: function (table) { validTable(table); return run(table, 'readonly', function (s) { return s.count(); }); },
    transaction: function (tables, callback) {
      tables = (Array.isArray(tables) ? tables : [tables]).map(validTable);
      return openDb().then(function (db) { return new Promise(function (resolve, reject) {
        var tx = db.transaction(tables, 'readwrite');
        var api = { get: function (table, id) { return tx.objectStore(validTable(table)).get(String(id)); }, put: function (table, value) { return tx.objectStore(validTable(table)).put(value); }, remove: function (table, id) { return tx.objectStore(validTable(table)).delete(String(id)); }, clear: function (table) { return tx.objectStore(validTable(table)).clear(); } };
        try { callback(api, tx); } catch (e) { tx.abort(); reject(e); return; }
        tx.oncomplete = function () { resolve(true); }; tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Giao dịch thất bại.')); };
      }); });
    }
  };

  function kioList(table, opts) {
    return kioApi().listCollection(remoteName(table), opts || {}).catch(function (err) {
      if (missingTable(err)) return [];
      throw err;
    });
  }

  var kioStore = {
    dbName: 'kio',
    driver: 'kio',
    tables: localStore.tables,
    remoteName: remoteName,
    ready: function () {
      return Promise.resolve().then(function () {
        if (typeof getKrudList !== 'function' || typeof sendFormDataKRUD !== 'function') {
          throw new Error('Chưa tải https://kio.dvqt.vn/list.js và krud.js.');
        }
        kioApi();
        return true;
      });
    },
    list: function (table, opts) { validTable(table); return kioList(table, opts); },
    get: function (table, id, opts) {
      validTable(table);
      var want = String(id);
      return kioList(table, opts).then(function (rows) {
        var found = null;
        (rows || []).some(function (r) {
          if (!r) return false;
          if (String(r.id) === want || String(r.code) === want || String(r.key) === want) { found = r; return true; }
          return false;
        });
        return found;
      });
    },
    put: function (table, record) {
      validTable(table);
      var copy = copyRecord(record);
      var remote = remoteName(table);
      if (APPEND_TABLES[table]) {
        return kioApi().appendCollection(remote, [copy]).then(function () { return copy; });
      }
      return kioList(table).then(function (rows) {
        if (!(rows && rows.length)) return kioApi().appendCollection(remote, [copy]);
        return kioApi().syncCollection(remote, [copy]);
      }).then(function () { return copy; });
    },
    putAll: function (table, records) {
      validTable(table);
      records = (Array.isArray(records) ? records : []).map(copyRecord);
      if (!records.length) return Promise.resolve(0);
      var remote = remoteName(table);
      if (APPEND_TABLES[table]) {
        return kioApi().appendCollection(remote, records).then(function () { return records.length; });
      }
      return kioList(table).then(function (rows) {
        if (!(rows && rows.length)) return kioApi().appendCollection(remote, records);
        return kioApi().syncCollection(remote, records);
      }).then(function () { return records.length; });
    },
    remove: function (table, id) {
      validTable(table);
      return kioApi().deleteKeys(remoteName(table), [String(id)]).then(function () { return true; });
    },
    query: function (table, criteria, opts) {
      validTable(table);
      return kioList(table, opts).then(function (rows) { return applyQuery(rows || [], criteria); });
    },
    invalidate: function (tables) {
      var api = kioApi();
      (Array.isArray(tables) ? tables : [tables]).forEach(function (table) {
        try { api.invalidateTable(remoteName(table)); } catch (_) {}
      });
    },
    clear: function (table) {
      validTable(table);
      return kioApi().replaceCollection(remoteName(table), []).then(function () { return true; });
    },
    count: function (table) {
      validTable(table);
      return kioList(table).then(function (rows) { return (rows || []).length; });
    },
    transaction: function () {
      return Promise.reject(new Error('KIO không hỗ trợ giao dịch. Dùng get/put/remove riêng.'));
    }
  };

  var store = isKio() ? kioStore : localStore;
  TTV.Store = store;
  TTV.store = store;
})(window.TTV);
