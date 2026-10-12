/* screens/admin/vendors.js — Danh sách và chi tiết thợ (task 3.4): #/admin/vendors, #/admin/vendors/:id.
   Chỉ SUPER_ADMIN. Mọi thao tác ghi (khóa/mở, đặt lại mật khẩu) đi qua TTV.api (kiểm quyền, audit_logs).
   Form sửa thông tin nằm ở vendor-form.js (#/admin/vendors/:id/edit). Mật khẩu tạm chỉ nằm trong DOM của cửa sổ kết quả. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var LIST = '/admin/vendors', PAGE_SIZE = 8;
  var token = 0;          // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var host = null;        // vùng nội dung của khung admin
  var list = null;        // { all, q, status, type, page } (màn danh sách)
  var detail = null;      // { id, vendor, services, defaultRate } (màn chi tiết)
  var modalBusy = false;
  var resetResult = null; // { name, username, password } khi cửa sổ kết quả đang mở

  function fold(v) { return String(v == null ? '' : v).toLocaleLowerCase('vi'); }
  function typeLabel(type) { return t('adminVendor.type.' + type); }
  function msg(e) { return (e && e.message) || t('adminVendors.err.generic'); }
  function isLocked(v) { return v.status === 'locked'; }
  function statusBadge(v) { return isLocked(v) ? C.badge(t('adminVendors.status.locked'), 'danger') : C.badge(t('adminVendors.status.active'), 'success'); }
  function chip(attr, value, label, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }
  function emptyBlock(icon, title, desc) { return '<section class="admin-empty"><span>' + icon + '</span><strong>' + esc(title) + '</strong><p>' + esc(desc) + '</p></section>'; }
  function goTo(path) { TTV.Router.navigate(path); }

  /* ===================== Danh sách ===================== */
  function matches(v) {
    if (list.status !== 'all' && (isLocked(v) ? 'locked' : 'active') !== list.status) return false;
    if (list.type !== 'all' && v.type !== list.type) return false;
    var q = fold(list.q).trim(); if (!q) return true;
    if (fold([v.name, v.username, v.phone, v.email].join(' ')).indexOf(q) >= 0) return true;
    var digits = q.replace(/\D/g, ''); // tìm SĐT không phân biệt dấu cách / dấu chấm
    return digits.length >= 3 && String(v.phone || '').replace(/\D/g, '').indexOf(digits) >= 0;
  }
  function statusChips() {
    var n = { all: list.all.length, active: 0, locked: 0 };
    list.all.forEach(function (v) { n[isLocked(v) ? 'locked' : 'active']++; });
    return ['all', 'active', 'locked'].map(function (k) { return chip('data-vl-status', k, t('adminVendors.filter.' + k) + ' (' + n[k] + ')', list.status === k); }).join('');
  }
  function typeChips() {
    return chip('data-vl-type', 'all', t('adminVendors.filter.anyType'), list.type === 'all') +
      TTV.api.VENDOR_TYPES.map(function (x) { return chip('data-vl-type', x.value, typeLabel(x.value), list.type === x.value); }).join('');
  }
  function recordHtml(v) {
    var sub = [v.username ? '@' + v.username : '', v.phone || ''].filter(Boolean).join(' · ');
    var badges = C.badge(typeLabel(v.type) + (v.type === 'personal' ? '' : ' · ' + t('adminVendors.teamSize', { n: v.team_size || 1 })), 'info') + statusBadge(v) +
      (v.must_change_pw ? C.badge(t('adminVendors.mustChange'), 'warning') : '');
    return '<article class="admin-record admin-record--link" role="link" tabindex="0" data-vl-open="' + esc(v.id) + '">' +
      '<span class="admin-record__avatar">' + esc(String(v.name || '?').trim().charAt(0).toUpperCase() || '?') + '</span>' +
      '<div class="admin-record__main"><strong>' + esc(v.name) + '</strong><p>' + esc(sub || t('adminVendors.none')) + '</p><div class="admin-record__badges">' + badges + '</div></div>' +
      '<span class="admin-record__chev" aria-hidden="true">›</span></article>';
  }
  function listShell() {
    return '<button type="button" class="btn btn-primary btn-block admin-create-btn" data-admin-route="/admin/vendors/new">' + esc(t('adminVendor.create')) + '</button>' +
      '<div class="admin-list-toolbar"><label class="admin-search"><span>⌕</span><input id="vl-search" type="search" placeholder="' + esc(t('adminVendors.search')) + '" aria-label="' + esc(t('adminVendors.search')) + '" autocomplete="off" value="' + esc(list.q) + '"></label></div>' +
      '<div class="admin-chip-row" id="vl-status-row" role="group">' + statusChips() + '</div>' +
      '<div class="admin-chip-row" id="vl-type-row" role="group">' + typeChips() + '</div>' +
      '<div class="admin-list-meta"><span id="vl-count"></span></div>' +
      '<div id="vl-results" class="admin-record-list"></div>' +
      '<div class="admin-pagination" id="vl-pager"><button type="button" data-vl-page="-1" id="vl-prev">' + esc(t('adminVendors.prev')) + '</button><span id="vl-page-label"></span><button type="button" data-vl-page="1" id="vl-next">' + esc(t('adminVendors.next')) + '</button></div>';
  }
  // Chỉ vẽ lại phần kết quả để ô tìm kiếm không mất focus khi gõ.
  function paintResults() {
    var rows = list.all.filter(matches), pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    list.page = Math.max(0, Math.min(list.page, pages - 1));
    var slice = rows.slice(list.page * PAGE_SIZE, (list.page + 1) * PAGE_SIZE);
    host.querySelector('#vl-results').innerHTML = rows.length ? slice.map(recordHtml).join('')
      : (list.all.length ? emptyBlock('⌕', t('adminVendors.noResult.title'), t('adminVendors.noResult.desc')) : emptyBlock('⚒', t('adminVendors.empty.title'), t('adminVendors.empty.desc')));
    host.querySelector('#vl-count').textContent = t('adminVendors.count', { n: rows.length });
    host.querySelector('#vl-page-label').textContent = t('adminVendors.page', { p: list.page + 1, n: pages });
    host.querySelector('#vl-prev').disabled = list.page <= 0;
    host.querySelector('#vl-next').disabled = list.page >= pages - 1;
    host.querySelector('#vl-pager').style.display = rows.length <= PAGE_SIZE ? 'none' : '';
  }
  function paintList() { host.innerHTML = listShell(); paintResults(); }
  function loadList(my) {
    host.innerHTML = C.loading();
    TTV.api.listVendors().then(function (rows) {
      if (my !== token) return;
      list = { all: rows, q: '', status: 'all', type: 'all', page: 0 };
      paintList();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminVendors.detail.retry'), action: 'vl-retry' });
    });
  }
  function renderList(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    list = null; detail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminVendors.title'), '', s && s.role);
    host = document.querySelector('.admin-content');
    loadList(my);
  }

  /* ===================== Chi tiết ===================== */
  function kv(label, valueHtml) { return '<div class="admin-kv__row"><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>'; }
  function none() { return esc(t('adminVendors.none')); }
  function serviceNames(v) {
    return (v.services || []).map(function (code) {
      var s = detail.services.filter(function (x) { return (x.code || x.id) === code; })[0];
      return s ? s.name : code;
    }).join(', ');
  }
  function areaNames(v) {
    return (v.areas || []).map(function (a) { var x = TTV.api.VENDOR_AREAS.filter(function (y) { return y.value === a; })[0]; return x ? x.label : a; }).join(', ');
  }
  function kycText(k) { return t(k === 'pending' || k === 'approved' || k === 'rejected' ? 'adminVendors.kyc.' + k : 'adminVendors.kyc.none'); }
  function detailHtml() {
    var v = detail.vendor, locked = isLocked(v), U = TTV.Utils;
    var badges = '<div class="admin-detail-badges">' + C.badge(typeLabel(v.type), 'info') + statusBadge(v) + (v.must_change_pw ? C.badge(t('adminVendors.mustChange'), 'warning') : '') + '</div>';
    var head = '<section class="admin-detail-head">' + C.avatar(v.name, v.avatar_path || '', { size: 'lg' }) + '<h2>' + esc(v.name) + '</h2>' +
      (v.username ? '<span class="admin-muted">@' + esc(v.username) + '</span>' : '') + badges + '</section>';
    var lockedNote = '';
    if (locked) {
      var parts = [];
      if (v.locked_at) parts.push(t('adminVendors.lockedSince', { date: U.date(v.locked_at) }));
      if (v.lock_reason) parts.push(t('adminVendors.lockedReason', { reason: v.lock_reason }));
      lockedNote = C.notice(parts.join(' · ') || t('adminVendors.lockedNote'), t('adminVendors.lockedNote'));
    }
    var rate = v.commission_rate == null ? t('adminVendors.commission.default', { rate: detail.defaultRate }) : t('adminVendors.commission.own', { rate: v.commission_rate });
    var info = '<dl class="admin-kv">' +
      kv(t('adminVendor.field.phone'), v.phone ? esc(v.phone) : none()) +
      kv(t('adminVendor.field.email'), v.email ? esc(v.email) : none()) +
      kv(t('adminVendor.field.teamSize'), esc(t('adminVendors.teamSize', { n: v.team_size || 1 }))) +
      kv(t('adminVendor.field.services'), serviceNames(v) ? esc(serviceNames(v)) : none()) +
      kv(t('adminVendor.field.areas'), areaNames(v) ? esc(areaNames(v)) : none()) +
      kv(t('adminVendor.field.vehicle'), v.vehicle ? esc(v.vehicle) : none()) +
      kv(t('adminVendor.field.commission'), esc(rate)) + '</dl>';
    var online = !locked && v.is_online;
    var activity = '<dl class="admin-kv">' +
      kv(t('adminVendors.field.status'), esc(t(online ? 'adminVendors.online' : 'adminVendors.offline'))) +
      kv(t('adminVendors.field.rating'), Number(v.rating) > 0 ? '★ ' + Number(v.rating).toFixed(1) : esc(t('adminVendors.noRating'))) +
      kv(t('adminVendors.field.jobs'), esc(t('adminVendors.jobs', { n: v.jobs_done || 0 }))) +
      kv(t('adminVendors.field.kyc'), esc(kycText(v.kyc_status))) +
      kv(t('adminVendors.field.wallet'), esc(U.money(v.wallet_balance || 0))) +
      kv(t('adminVendors.field.created'), v.created_at ? esc(U.date(v.created_at)) : none()) + '</dl>';
    var pw = !v.has_password ? 'adminVendors.pw.missing' : (v.must_change_pw ? 'adminVendors.pw.temp' : 'adminVendors.pw.set');
    var account = '<dl class="admin-kv">' +
      kv(t('adminVendor.field.username'), v.username ? '<code class="admin-code">' + esc(v.username) + '</code>' : none()) +
      kv(t('adminVendors.field.password'), esc(t(pw))) + '</dl>';
    var actions = '<div class="admin-actions">' +
      '<button type="button" class="btn btn-primary btn-block" data-admin-route="' + LIST + '/' + encodeURIComponent(v.id) + '/edit">' + esc(t('adminVendors.btn.edit')) + '</button>' +
      '<button type="button" class="btn btn-secondary btn-block" data-vd="reset"' + (v.username ? '' : ' disabled') + '>' + esc(t('adminVendors.btn.reset')) + '</button>' +
      (locked ? '<button type="button" class="btn btn-secondary btn-block" data-vd="unlock">' + esc(t('adminVendors.btn.unlock')) + '</button>'
        : '<button type="button" class="btn btn-danger btn-block" data-vd="lock">' + esc(t('adminVendors.btn.lock')) + '</button>') + '</div>';
    return '<div class="admin-detail">' + head + lockedNote + C.card(info, { title: t('adminVendor.section.info') }) + C.card(activity, { title: t('adminVendors.section.activity') }) +
      C.card(account, { title: t('adminVendors.section.account') }) + C.card(actions) + '</div>';
  }
  function paintDetail() { host.innerHTML = detailHtml(); }
  function loadDetail(my, id) {
    host.innerHTML = C.loading();
    Promise.all([TTV.api.getVendor(id), TTV.api.listServices(), TTV.api.getSetting('commission_default')]).then(function (r) {
      if (my !== token) return;
      if (!r[0]) { host.innerHTML = C.emptyState(t('adminVendors.detail.notFound'), t('adminVendors.detail.notFoundDesc'), { icon: '?', label: t('adminVendors.detail.back'), action: 'vd-back' }); return; }
      detail = { id: r[0].id, vendor: r[0], services: r[1] || [], defaultRate: r[2] == null ? 15 : r[2] };
      paintDetail();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('adminVendors.detail.loadError'), msg(e), { icon: '!', label: t('adminVendors.detail.retry'), action: 'vd-retry' });
    });
  }
  function renderDetail(ctx) {
    var s = TTV.auth.getSession(), my = ++token, id = ctx.params.id;
    list = null; detail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminVendors.detail.title'), '', s && s.role, { back: LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    host.setAttribute('data-vendor-id', id);
    loadDetail(my, id);
  }

  /* ===================== Cửa sổ xác nhận ===================== */
  // Cửa sổ riêng (không dùng data-modal-close của components.js) vì có ô nhập và cửa sổ hiện mật khẩu không được đóng nhầm.
  function closeModals() {
    document.querySelectorAll('[data-vd-backdrop]').forEach(function (el) { el.remove(); });
    modalBusy = false; resetResult = null;
  }
  function openModal(title, body, footer) {
    closeModals();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-backdrop" data-vd-backdrop><section class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<header class="modal__header"><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-vd="close" aria-label="' + esc(t('adminVendors.btn.close')) + '">×</button></header>' +
      '<div class="modal__body">' + body + '</div><footer class="modal__footer"><div class="admin-modal-actions">' + footer + '</div></footer></section></div>');
  }
  function btn(cls, action, label) { return '<button type="button" class="btn ' + cls + '" data-vd="' + action + '">' + esc(label) + '</button>'; }
  function setBusy(on) {
    modalBusy = on;
    document.querySelectorAll('[data-vd-backdrop] [data-vd^="confirm"]').forEach(function (b) {
      b.disabled = on;
      if (on) { b.setAttribute('data-label', b.textContent); b.textContent = t('adminVendors.btn.working'); } else if (b.getAttribute('data-label')) b.textContent = b.getAttribute('data-label');
    });
  }

  function askLock() {
    var name = detail.vendor.name;
    openModal(t('adminVendors.lock.title'),
      '<p class="admin-modal-text">' + esc(t('adminVendors.lock.body', { name: name })) + '</p>' +
      '<label class="field__label" for="vd-reason">' + esc(t('adminVendors.lock.reason')) + '</label>' +
      '<textarea id="vd-reason" class="admin-textarea" maxlength="200" placeholder="' + esc(t('adminVendors.lock.reasonPh')) + '"></textarea>',
      btn('btn-secondary', 'close', t('adminVendors.btn.cancel')) + btn('btn-danger', 'confirm-lock', t('adminVendors.lock.confirm')));
  }
  function askUnlock() {
    openModal(t('adminVendors.unlock.title'), '<p class="admin-modal-text">' + esc(t('adminVendors.unlock.body', { name: detail.vendor.name })) + '</p>',
      btn('btn-secondary', 'close', t('adminVendors.btn.cancel')) + btn('btn-primary', 'confirm-unlock', t('adminVendors.unlock.confirm')));
  }
  function askReset() {
    openModal(t('adminVendors.reset.title'), '<p class="admin-modal-text">' + esc(t('adminVendors.reset.body', { name: detail.vendor.name })) + '</p>',
      btn('btn-secondary', 'close', t('adminVendors.btn.cancel')) + btn('btn-primary', 'confirm-reset', t('adminVendors.reset.confirm')));
  }

  function doStatus(status) {
    if (modalBusy || !detail) return;
    var my = token, reasonEl = document.getElementById('vd-reason'), reason = reasonEl ? reasonEl.value : '';
    setBusy(true);
    TTV.api.setVendorStatus(detail.id, status, reason).then(function (v) {
      if (my !== token || !detail) return;
      detail.vendor = v; closeModals(); paintDetail();
      C.toast(t(status === 'locked' ? 'adminVendors.toast.locked' : 'adminVendors.toast.unlocked'), 'success');
    }).catch(function (e) {
      if (my !== token) return;
      setBusy(false); C.toast(msg(e), 'error');
    });
  }

  function credRow(label, value, action) {
    return '<div class="admin-cred__row"><div><span class="admin-cred__label">' + esc(label) + '</span><b class="admin-cred__value">' + esc(value) + '</b></div>' +
      '<button type="button" class="btn btn-secondary admin-mini-btn" data-vd="' + action + '">' + esc(t('adminVendor.btn.copy')) + '</button></div>';
  }
  // Thay nội dung cửa sổ xác nhận bằng kết quả: mật khẩu tạm hiện một lần.
  function showResetResult(r) {
    resetResult = { name: r.vendor.name, username: r.username, password: r.password };
    var modal = document.querySelector('[data-vd-backdrop] .modal'); if (!modal) return;
    modal.querySelector('h2').textContent = t('adminVendors.reset.doneTitle');
    modal.querySelector('.modal__body').innerHTML = '<div class="admin-cred">' + credRow(t('adminVendor.done.username'), r.username, 'copy-user') + credRow(t('adminVendor.done.password'), r.password, 'copy-pw') + '</div>' + C.notice(t('adminVendors.reset.warn'));
    modal.querySelector('.admin-modal-actions').innerHTML = btn('btn-primary', 'copy-all', t('adminVendor.done.copyAll')) + btn('btn-secondary', 'close', t('adminVendors.btn.close'));
  }
  function doReset() {
    if (modalBusy || !detail) return;
    var my = token; setBusy(true);
    TTV.api.resetVendorPassword(detail.id).then(function (r) {
      if (my !== token || !detail) return;
      detail.vendor = r.vendor; modalBusy = false; paintDetail(); showResetResult(r);
    }).catch(function (e) {
      if (my !== token) return;
      setBusy(false); C.toast(msg(e), 'error');
    });
  }
  function copyText(text) {
    var form = TTV.screens.adminVendorForm;
    if (form && form.copyText) form.copyText(text);
  }
  function copyAllText() {
    var r = resetResult, url = location.href.split('#')[0] + '#/staff-login';
    return [t('adminVendor.copy.header'), t('adminVendor.copy.name') + ': ' + r.name, t('adminVendor.done.username') + ': ' + r.username, t('adminVendor.done.password') + ': ' + r.password, t('adminVendor.copy.login') + ': ' + url].join('\n');
  }

  /* ===================== Sự kiện ===================== */
  function syncChips(rowId, attr, value) {
    var row = host.querySelector('#' + rowId); if (!row) return;
    row.querySelectorAll('[' + attr + ']').forEach(function (b) { var on = b.getAttribute(attr) === value; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function onClick(e) {
    var el, target = e.target;
    if (!target || !target.closest) return;
    if (target.hasAttribute('data-vd-backdrop')) { if (!modalBusy && !resetResult) closeModals(); return; } // chạm nền ngoài để đóng (trừ lúc đang xử lý / đang hiện mật khẩu)
    if ((el = target.closest('[data-vd]'))) {
      var a = el.getAttribute('data-vd');
      if (a === 'close') { if (!modalBusy) closeModals(); return; }
      if (!detail) return;
      if (a === 'lock') askLock(); else if (a === 'unlock') askUnlock(); else if (a === 'reset') askReset();
      else if (a === 'confirm-lock') doStatus('locked'); else if (a === 'confirm-unlock') doStatus('active'); else if (a === 'confirm-reset') doReset();
      else if (a === 'copy-user' && resetResult) copyText(resetResult.username);
      else if (a === 'copy-pw' && resetResult) copyText(resetResult.password);
      else if (a === 'copy-all' && resetResult) copyText(copyAllText());
      return;
    }
    if (list) {
      if ((el = target.closest('[data-vl-open]'))) { goTo(LIST + '/' + encodeURIComponent(el.getAttribute('data-vl-open'))); return; }
      if ((el = target.closest('[data-vl-status]'))) { list.status = el.getAttribute('data-vl-status'); list.page = 0; syncChips('vl-status-row', 'data-vl-status', list.status); paintResults(); return; }
      if ((el = target.closest('[data-vl-type]'))) { list.type = el.getAttribute('data-vl-type'); list.page = 0; syncChips('vl-type-row', 'data-vl-type', list.type); paintResults(); return; }
      if ((el = target.closest('[data-vl-page]'))) { list.page += Number(el.getAttribute('data-vl-page')); paintResults(); window.scrollTo(0, 0); return; }
    }
    if ((el = target.closest('[data-action]'))) {
      var act = el.getAttribute('data-action');
      if (act === 'vl-retry' && host) { loadList(token); return; }
      if (act === 'vd-retry' && host) { loadDetail(token, host.getAttribute('data-vendor-id')); return; }
      if (act === 'vd-back') goTo(LIST);
    }
  }
  function onInput(e) {
    if (list && e.target && e.target.id === 'vl-search') { list.q = e.target.value; list.page = 0; paintResults(); }
  }
  function onKeydown(e) {
    if (!list || (e.key !== 'Enter' && e.key !== ' ')) return;
    var el = e.target && e.target.closest && e.target.closest('[data-vl-open]');
    if (el && e.target === el) { e.preventDefault(); goTo(LIST + '/' + encodeURIComponent(el.getAttribute('data-vl-open'))); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);

  function destroy() { token++; list = null; detail = null; host = null; closeModals(); } // bỏ mật khẩu tạm khỏi bộ nhớ khi rời màn

  TTV.screens.adminVendors = { renderList: renderList, renderDetail: renderDetail, destroy: destroy };
  var opts = { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy };
  TTV.Router.add('/admin/vendors', renderList, opts);
  TTV.Router.add('/admin/vendors/:id', renderDetail, opts); // '/admin/vendors/new' đã được vendor-form.js đăng ký trước nên khớp trước
})(window.TTV);
