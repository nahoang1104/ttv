/* screens/admin/audit-logs.js — Nhật ký hoạt động #/admin/audit-logs (task 3.7).
   Chỉ SUPER_ADMIN, chỉ XEM (không sửa/xóa). Dữ liệu đọc qua TTV.api.listAuditLogs (kiểm quyền, loại khóa nhạy cảm).
   Bảng KIO: ttv_audit_logs (chỉ append). Màn này không ghi audit. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var BACK = '/admin/more', PAGE_SIZE = 10, DAY = 86400000;
  var GROUP_ICON = { auth: '♙', vendor: '⚒', customer: '☺', settings: '⚙', other: '◷' };
  var GROUP_BADGE = { auth: 'info', vendor: 'success', customer: 'info', settings: 'warning', other: 'neutral' };
  var token = 0;     // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var host = null;   // vùng nội dung của khung admin
  var state = null;  // { all, q, group, range, page }

  function fold(v) { return String(v == null ? '' : v).toLocaleLowerCase('vi'); }
  function label(prefix, key, fallback) { var k = prefix + key, s = t(k); return s === k ? (fallback == null ? key : fallback) : s; }
  function actionLabel(a) { return label('adminLog.act.', a.action, a.action || t('adminLog.unknown')); }
  function actorLabel(a) {
    if (a.actor_name) return a.actor_name;
    if (!a.actor_id || a.actor_id === 'system') return t('adminLog.system');
    return a.actor_id;
  }
  function when(iso, withSeconds) {
    var o = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    if (withSeconds) o.second = '2-digit';
    return TTV.Utils.date(iso, o) || '—';
  }
  function targetHint(a) {
    var d = a.detail;
    if (d && typeof d === 'object' && d.username) return '@' + d.username;
    if (a.group === 'settings') return a.target_id.length > 28 ? a.target_id.slice(0, 27) + '…' : a.target_id;
    return '';
  }
  function chip(attr, value, text, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(text) + '</button>';
  }
  function emptyBlock(icon, title, desc) { return '<section class="admin-empty"><span>' + icon + '</span><strong>' + esc(title) + '</strong><p>' + esc(desc) + '</p></section>'; }

  /* ===================== Lọc ===================== */
  function inRange(a) {
    if (state.range === 'all') return true;
    var ms = new Date(a.created_at).getTime();
    if (!isFinite(ms)) return false;
    if (state.range === 'today') { var d = new Date(); d.setHours(0, 0, 0, 0); return ms >= d.getTime(); }
    return ms >= Date.now() - (state.range === '7d' ? 7 : 30) * DAY;
  }
  function haystack(a) {
    var d = a.detail == null ? '' : (typeof a.detail === 'string' ? a.detail : JSON.stringify(a.detail));
    return fold([actionLabel(a), a.action, actorLabel(a), a.actor_id, a.actor_role, a.target_table, a.target_id, d].join(' '));
  }
  function matches(a) {
    if (state.group !== 'all' && a.group !== state.group) return false;
    if (!inRange(a)) return false;
    var q = fold(state.q).trim();
    return !q || haystack(a).indexOf(q) >= 0;
  }

  /* ===================== Danh sách ===================== */
  function groupChips() {
    var n = { all: state.all.length };
    state.all.forEach(function (a) { n[a.group] = (n[a.group] || 0) + 1; });
    return ['all'].concat(TTV.api.AUDIT_GROUPS).map(function (g) {
      return chip('data-al-group', g, t('adminLog.filter.' + g) + ' (' + (n[g] || 0) + ')', state.group === g);
    }).join('');
  }
  function rangeChips() {
    return ['all', 'today', '7d', '30d'].map(function (r) { return chip('data-al-range', r, t('adminLog.range.' + r), state.range === r); }).join('');
  }
  function recordHtml(a) {
    var hint = targetHint(a);
    var badges = C.badge(t('adminLog.group.' + a.group), GROUP_BADGE[a.group] || 'neutral') + (hint ? C.badge(hint, 'neutral') : '');
    return '<article class="admin-record admin-record--link" role="button" tabindex="0" data-al-open="' + esc(a.id) + '">' +
      '<span class="admin-record__avatar">' + (GROUP_ICON[a.group] || GROUP_ICON.other) + '</span>' +
      '<div class="admin-record__main"><strong>' + esc(actionLabel(a)) + '</strong>' +
      '<p>' + esc(actorLabel(a) + ' · ' + when(a.created_at)) + '</p>' +
      '<div class="admin-record__badges">' + badges + '</div></div>' +
      '<span class="admin-record__chev" aria-hidden="true">›</span></article>';
  }
  function listShell() {
    return '<p class="admin-page-intro">' + esc(t('adminLog.intro')) + '</p>' +
      '<div class="admin-list-toolbar"><label class="admin-search"><span>⌕</span><input id="al-search" type="search" placeholder="' + esc(t('adminLog.search')) + '" aria-label="' + esc(t('adminLog.search')) + '" autocomplete="off" value="' + esc(state.q) + '"></label>' +
      '<button type="button" class="admin-filter-button" data-al-refresh aria-label="' + esc(t('adminLog.refresh')) + '">↻ <span>' + esc(t('adminLog.refresh')) + '</span></button></div>' +
      '<div class="admin-chip-row" id="al-group-row" role="group">' + groupChips() + '</div>' +
      '<div class="admin-chip-row" id="al-range-row" role="group">' + rangeChips() + '</div>' +
      '<div class="admin-list-meta"><span id="al-count"></span></div>' +
      '<div id="al-results" class="admin-record-list"></div>' +
      '<div class="admin-pagination" id="al-pager"><button type="button" data-al-page="-1" id="al-prev">' + esc(t('adminLog.prev')) + '</button><span id="al-page-label"></span><button type="button" data-al-page="1" id="al-next">' + esc(t('adminLog.next')) + '</button></div>';
  }
  // Chỉ vẽ lại phần kết quả để ô tìm kiếm không mất focus khi gõ.
  function paintResults() {
    var rows = state.all.filter(matches), pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.page = Math.max(0, Math.min(state.page, pages - 1));
    var slice = rows.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    host.querySelector('#al-results').innerHTML = rows.length ? slice.map(recordHtml).join('')
      : (state.all.length ? emptyBlock('⌕', t('adminLog.noResult.title'), t('adminLog.noResult.desc')) : emptyBlock('◷', t('adminLog.empty.title'), t('adminLog.empty.desc')));
    host.querySelector('#al-count').textContent = t('adminLog.count', { n: rows.length });
    host.querySelector('#al-page-label').textContent = t('adminLog.page', { p: state.page + 1, n: pages });
    host.querySelector('#al-prev').disabled = state.page <= 0;
    host.querySelector('#al-next').disabled = state.page >= pages - 1;
    host.querySelector('#al-pager').style.display = rows.length <= PAGE_SIZE ? 'none' : '';
  }
  function paintChips() {
    host.querySelector('#al-group-row').innerHTML = groupChips();
    host.querySelector('#al-range-row').innerHTML = rangeChips();
  }
  function paintList() { host.innerHTML = listShell(); paintResults(); }

  function load(my, keep) {
    host.innerHTML = C.loading();
    closeModal();
    TTV.api.listAuditLogs().then(function (rows) {
      if (my !== token) return;
      state = { all: rows, q: keep ? keep.q : '', group: keep ? keep.group : 'all', range: keep ? keep.range : 'all', page: 0 };
      paintList();
    }).catch(function (e) {
      if (my !== token) return;
      state = null;
      host.innerHTML = C.emptyState(t('adminLog.loadError'), (e && e.message) || t('common.error'), { icon: '!', label: t('adminLog.retry'), action: 'al-retry' });
    });
  }
  function render(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    state = null; closeModal();
    TTV.screens.admin.shell(ctx.path, t('adminLog.title'), '', s && s.role, { back: BACK });
    host = document.querySelector('.admin-content');
    load(my);
  }

  /* ===================== Chi tiết một dòng ===================== */
  function fmtVal(v) {
    if (v == null || v === '') return t('adminLog.empty.value');
    if (typeof v === 'boolean') return t(v ? 'adminLog.yes' : 'adminLog.no');
    if (typeof v === 'number') return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(v);
    if (Array.isArray(v)) return v.length ? v.map(fmtVal).join(', ') : t('adminLog.empty.value');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
  function isFromTo(v) { return v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'from') && Object.prototype.hasOwnProperty.call(v, 'to'); }
  function flatten(obj, prefix, rows) {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k], name = label('adminLog.f.', k), text = prefix ? prefix + ' › ' + name : name;
      if (isFromTo(v)) rows.push([text, t('adminLog.from', { from: fmtVal(v.from), to: fmtVal(v.to) })]);
      else if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, text, rows);
      else if (k === 'fields' && Array.isArray(v)) rows.push([text, v.map(function (x) { return label('adminLog.f.', x); }).join(', ')]);
      else rows.push([text, fmtVal(v)]);
    });
    return rows;
  }
  function kv(name, valueHtml) { return '<div class="admin-kv__row"><dt>' + esc(name) + '</dt><dd>' + valueHtml + '</dd></div>'; }
  function detailBody(a) {
    var role = a.actor_role ? ' (' + a.actor_role + ')' : '';
    var info = '<dl class="admin-kv">' +
      kv(t('adminLog.detail.action'), esc(actionLabel(a)) + '<br><code class="admin-code">' + esc(a.action) + '</code>') +
      kv(t('adminLog.detail.actor'), esc(actorLabel(a) + role) + (a.actor_id ? '<br><code class="admin-code">' + esc(a.actor_id) + '</code>' : '')) +
      kv(t('adminLog.detail.time'), esc(when(a.created_at, true))) +
      kv(t('adminLog.detail.target'), a.target_table || a.target_id ? esc([a.target_table, a.target_id].filter(Boolean).join(' · ')) : esc(t('adminLog.empty.value'))) + '</dl>';
    var d = a.detail, rows = [];
    if (d && typeof d === 'object' && !Array.isArray(d)) flatten(d, '', rows);
    else if (d != null && d !== '') rows.push([t('adminLog.detail.data'), fmtVal(d)]);
    var data = rows.length
      ? '<h3 class="admin-modal-sub">' + esc(t('adminLog.detail.data')) + '</h3><dl class="admin-kv">' + rows.map(function (r) { return kv(r[0], esc(r[1])); }).join('') + '</dl>'
      : '<p class="admin-modal-text admin-muted">' + esc(t('adminLog.detail.none')) + '</p>';
    return info + data;
  }
  function closeModal() { document.querySelectorAll('[data-al-backdrop]').forEach(function (el) { el.remove(); }); }
  function openDetail(id) {
    var a = state && state.all.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    closeModal();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-backdrop" data-al-backdrop><section class="modal" role="dialog" aria-modal="true" aria-label="' + esc(t('adminLog.detail.title')) + '">' +
      '<header class="modal__header"><h2>' + esc(t('adminLog.detail.title')) + '</h2><button type="button" class="icon-btn" data-al="close" aria-label="' + esc(t('adminLog.close')) + '">×</button></header>' +
      '<div class="modal__body">' + detailBody(a) + '</div>' +
      '<footer class="modal__footer"><div class="admin-modal-actions"><button type="button" class="btn btn-secondary" data-al="close">' + esc(t('adminLog.close')) + '</button></div></footer></section></div>');
  }

  /* ===================== Sự kiện ===================== */
  function onClick(e) {
    var target = e.target, el;
    if (!target || !target.closest) return;
    if (target.hasAttribute && target.hasAttribute('data-al-backdrop')) { closeModal(); return; }
    if ((el = target.closest('[data-al="close"]'))) { closeModal(); return; }
    if (!host || !host.contains(target)) return;
    if ((el = target.closest('[data-action="al-retry"]'))) { load(token); return; }
    if (!state) return;
    if ((el = target.closest('[data-al-open]'))) { openDetail(el.getAttribute('data-al-open')); return; }
    if ((el = target.closest('[data-al-group]'))) { state.group = el.getAttribute('data-al-group'); state.page = 0; paintChips(); paintResults(); return; }
    if ((el = target.closest('[data-al-range]'))) { state.range = el.getAttribute('data-al-range'); state.page = 0; paintChips(); paintResults(); return; }
    if ((el = target.closest('[data-al-page]'))) { state.page += Number(el.getAttribute('data-al-page')) || 0; paintResults(); return; }
    if (target.closest('[data-al-refresh]')) { load(token, { q: state.q, group: state.group, range: state.range }); }
  }
  function onInput(e) {
    if (state && host && e.target && e.target.id === 'al-search') { state.q = e.target.value; state.page = 0; paintResults(); }
  }
  function onKeydown(e) {
    if (e.key === 'Escape' && document.querySelector('[data-al-backdrop]')) { closeModal(); return; }
    if (!state || (e.key !== 'Enter' && e.key !== ' ')) return;
    var el = e.target && e.target.closest && e.target.closest('[data-al-open]');
    if (el && e.target === el) { e.preventDefault(); openDetail(el.getAttribute('data-al-open')); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);

  function destroy() { token++; state = null; host = null; closeModal(); }

  TTV.screens.adminAuditLogs = { render: render, destroy: destroy };
  TTV.Router.add('/admin/audit-logs', render, { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy });
})(window.TTV);
