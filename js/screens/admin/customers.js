/* screens/admin/customers.js — Quản lý khách (task 8.1): #/admin/customers, #/admin/customers/:id.
   Chỉ SUPER_ADMIN. Mọi thao tác ghi (khóa/mở, cộng/trừ ví, reset thiết bị) đi qua TTV.api (kiểm quyền, audit_logs).
   Chi tiết chia 5 tab chip: Hồ sơ · Đơn · Ví · Địa chỉ · Thiết bị. Cửa sổ nhập liệu là markup riêng (data-cu-backdrop)
   vì C.modal đóng cả cửa sổ khi bấm vào ô nhập (xem ghi chú ở task 3.4). */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var LIST = '/admin/customers', PAGE_SIZE = 8, TABS = ['profile', 'orders', 'wallet', 'addresses', 'devices'];
  var SHOW_ROWS = 10;     // số dòng đơn / giao dịch hiện ban đầu ở tab chi tiết
  var token = 0;          // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var host = null;        // vùng nội dung của khung admin
  var list = null;        // { all, q, status, page }
  var detail = null;      // { id, data, tab, more:{orders,wallet} }
  var modalBusy = false;
  var walletDir = 'in';   // hướng đang chọn trong cửa sổ cộng/trừ ví

  function fold(v) { return String(v == null ? '' : v).toLocaleLowerCase('vi'); }
  function msg(e) { return (e && e.message) || t('adminCust.err.generic'); }
  function isLocked(c) { return c.status === 'locked'; }
  function money(n) { return TTV.Utils.money(n || 0); }
  function when(iso) { return TTV.Utils.date(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'; }
  function statusBadge(c) { return isLocked(c) ? C.badge(t('adminCust.status.locked'), 'danger') : C.badge(t('adminCust.status.active'), 'success'); }
  function chip(attr, value, label, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }
  function emptyBlock(icon, title, desc) { return '<section class="admin-empty"><span>' + icon + '</span><strong>' + esc(title) + '</strong><p>' + esc(desc) + '</p></section>'; }
  function goTo(path) { TTV.Router.navigate(path); }
  function displayName(c) { return c.name || t('adminCust.noName'); }

  /* ===================== Danh sách ===================== */
  function matches(c) {
    if (list.status !== 'all' && (isLocked(c) ? 'locked' : 'active') !== list.status) return false;
    var q = fold(list.q).trim(); if (!q) return true;
    if (fold([c.name, c.phone, c.email].join(' ')).indexOf(q) >= 0) return true;
    var digits = q.replace(/\D/g, ''); // tìm SĐT không phân biệt dấu cách / dấu chấm / +84
    if (digits.length < 3) return false;
    var ph = String(c.phone || '').replace(/\D/g, '');
    return ph.indexOf(digits) >= 0 || ph.indexOf(digits.replace(/^0/, '84')) >= 0 || ('0' + ph.replace(/^84/, '')).indexOf(digits) >= 0;
  }
  function statusChips() {
    var n = { all: list.all.length, active: 0, locked: 0 };
    list.all.forEach(function (c) { n[isLocked(c) ? 'locked' : 'active']++; });
    return ['all', 'active', 'locked'].map(function (k) { return chip('data-cl-status', k, t('adminCust.filter.' + k) + ' (' + n[k] + ')', list.status === k); }).join('');
  }
  function recordHtml(c) {
    var sub = [c.phone, c.email].filter(Boolean).join(' · ');
    var badges = statusBadge(c) + C.badge(t('adminCust.orderCount', { n: c.orders_count }), 'info') + C.badge(money(c.wallet_balance), 'neutral');
    return '<article class="admin-record admin-record--link" role="link" tabindex="0" data-cl-open="' + esc(c.id) + '">' +
      TTV.screens.admin.avatarHtml(c.name, c.avatar_path, 'admin-record__avatar') +
      '<div class="admin-record__main"><strong>' + esc(displayName(c)) + '</strong><p>' + esc(sub || t('adminCust.none')) + '</p><div class="admin-record__badges">' + badges + '</div></div>' +
      '<span class="admin-record__chev" aria-hidden="true">›</span></article>';
  }
  function listShell() {
    return '<div class="admin-list-toolbar"><label class="admin-search"><span>⌕</span><input id="cl-search" type="search" placeholder="' + esc(t('adminCust.search')) + '" aria-label="' + esc(t('adminCust.search')) + '" autocomplete="off" value="' + esc(list.q) + '"></label></div>' +
      '<div class="admin-chip-row" id="cl-status-row" role="group">' + statusChips() + '</div>' +
      '<div class="admin-list-meta"><span id="cl-count"></span></div>' +
      '<div id="cl-results" class="admin-record-list"></div>' +
      '<div class="admin-pagination" id="cl-pager"><button type="button" data-cl-page="-1" id="cl-prev">' + esc(t('adminCust.prev')) + '</button><span id="cl-page-label"></span><button type="button" data-cl-page="1" id="cl-next">' + esc(t('adminCust.next')) + '</button></div>';
  }
  function paintResults() {
    var rows = list.all.filter(matches), pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    list.page = Math.max(0, Math.min(list.page, pages - 1));
    var slice = rows.slice(list.page * PAGE_SIZE, (list.page + 1) * PAGE_SIZE);
    host.querySelector('#cl-results').innerHTML = rows.length ? slice.map(recordHtml).join('')
      : (list.all.length ? emptyBlock('⌕', t('adminCust.noResult.title'), t('adminCust.noResult.desc')) : emptyBlock('♙', t('adminCust.empty.title'), t('adminCust.empty.desc')));
    host.querySelector('#cl-count').textContent = t('adminCust.count', { n: rows.length });
    host.querySelector('#cl-page-label').textContent = t('adminCust.page', { p: list.page + 1, n: pages });
    host.querySelector('#cl-prev').disabled = list.page <= 0;
    host.querySelector('#cl-next').disabled = list.page >= pages - 1;
    host.querySelector('#cl-pager').style.display = rows.length <= PAGE_SIZE ? 'none' : '';
  }
  function loadList(my) {
    host.innerHTML = C.loading();
    TTV.api.listCustomers().then(function (rows) {
      if (my !== token) return;
      list = { all: rows, q: '', status: 'all', page: 0 };
      host.innerHTML = listShell(); paintResults();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminCust.retry'), action: 'cl-retry' });
    });
  }
  function renderList(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    list = null; detail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminCust.title'), '', s && s.role);
    host = document.querySelector('.admin-content');
    loadList(my);
  }

  /* ===================== Chi tiết ===================== */
  function kv(label, valueHtml) { return '<div class="admin-kv__row"><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>'; }
  function none() { return esc(t('adminCust.none')); }
  function orderGroup(st) { return st === 'finding' ? 'finding' : st === 'completed' ? 'done' : st === 'cancelled' ? 'cancelled' : 'doing'; }
  function orderBadge(st) {
    var g = orderGroup(st);
    return C.badge(t('orders.status.' + g), { finding: 'warning', doing: 'info', done: 'success', cancelled: 'neutral' }[g]);
  }
  function txSign(tx) { return tx.type === 'topup' || tx.type === 'refund' ? '+' : '−'; }
  function txTitle(tx) {
    if (tx.method === 'admin') return t(tx.type === 'topup' ? 'adminCust.tx.adminIn' : 'adminCust.tx.adminOut');
    if (tx.type === 'topup') return t('wallet.tx.topup');
    if (tx.type === 'refund') return t('wallet.tx.refund');
    if (tx.type === 'hold') return t('wallet.tx.hold');
    return t('wallet.tx.payment');
  }
  function moreBtn(key, shown, total) {
    return total > shown ? '<button type="button" class="btn btn-secondary btn-block admin-more-btn" data-cd-more="' + key + '">' + esc(t('adminCust.showMore', { n: total - shown })) + '</button>' : '';
  }

  function tabProfile(d) {
    var c = d.customer, locked = isLocked(c);
    var info = '<dl class="admin-kv">' +
      kv(t('adminCust.f.phone'), c.phone ? esc(c.phone) : none()) +
      kv(t('adminCust.f.email'), c.email ? esc(c.email) : none()) +
      kv(t('adminCust.f.gender'), esc(({ male: 'Nam', female: 'Nữ', other: 'Khác' })[c.gender] || t('adminCust.none'))) +
      kv(t('adminCust.f.dob'), c.dob ? esc(c.dob.split('-').reverse().join('/')) : none()) +
      kv(t('adminCust.f.login'), esc(t('adminCust.login.' + (c.login_method === 'zalo' || c.login_method === 'google' ? c.login_method : 'phone')))) +
      kv(t('adminCust.f.kyc'), esc((TTV.api.KYC_LABELS || {})[c.kyc_status] || t('adminCust.none'))) +
      kv(t('adminCust.f.created'), c.created_at ? esc(when(c.created_at)) : none()) + '</dl>';
    var st = d.stats;
    var stats = '<dl class="admin-kv">' + kv(t('adminCust.stat.orders'), esc(String(st.orders))) + kv(t('adminCust.stat.completed'), esc(String(st.completed))) +
      kv(t('adminCust.stat.active'), esc(String(st.active))) + kv(t('adminCust.stat.wallet'), esc(money(c.wallet_balance))) + '</dl>';
    var actions = '<div class="admin-actions">' + (locked
      ? '<button type="button" class="btn btn-secondary btn-block" data-cd="unlock">' + esc(t('adminCust.btn.unlock')) + '</button>'
      : '<button type="button" class="btn btn-danger btn-block" data-cd="lock">' + esc(t('adminCust.btn.lock')) + '</button>') + '</div>';
    return C.card(info, { title: t('adminCust.section.info') }) + C.card(stats, { title: t('adminCust.section.stats') }) + C.card(actions);
  }
  function tabOrders(d) {
    if (!d.orders.length) return emptyBlock('▣', t('adminCust.orders.empty'), t('adminCust.orders.emptyDesc'));
    var n = detail.more.orders ? d.orders.length : SHOW_ROWS;
    return '<div class="admin-record-list">' + d.orders.slice(0, n).map(function (o) {
      var price = o.final_price != null ? o.final_price : o.user_offer;
      return '<article class="admin-record admin-record--link" role="link" tabindex="0" data-cd-order="' + esc(o.id) + '"><div class="admin-record__main"><strong>' + esc(o.service_name || t('adminCust.none')) + ' · ' + esc(o.code) + '</strong>' +
        '<p>' + esc(o.pickup || '—') + ' → ' + esc(o.dropoff || '—') + '</p>' +
        '<div class="admin-record__badges">' + orderBadge(o.status) + C.badge(money(price), 'neutral') + C.badge(t('adminCust.workers', { n: o.workers }), 'info') + '</div>' +
        '<p class="admin-muted">' + esc(when(o.created_at)) + '</p></div><span class="admin-record__chev" aria-hidden="true">›</span></article>';
    }).join('') + '</div>' + moreBtn('orders', n, d.orders.length);
  }
  function tabWallet(d) {
    var c = d.customer;
    var head = '<div class="admin-wallet-head"><span class="admin-muted">' + esc(t('adminCust.wallet.balance')) + '</span><strong>' + esc(money(c.wallet_balance)) + '</strong>' +
      '<div class="admin-wallet-btns"><button type="button" class="btn btn-primary" data-cd="wallet-in">' + esc(t('adminCust.btn.walletIn')) + '</button>' +
      '<button type="button" class="btn btn-secondary" data-cd="wallet-out">' + esc(t('adminCust.btn.walletOut')) + '</button></div></div>';
    var n = detail.more.wallet ? d.transactions.length : SHOW_ROWS;
    var rows = d.transactions.length ? '<div class="admin-record-list">' + d.transactions.slice(0, n).map(function (tx) {
      var pend = tx.status === 'pending' ? C.badge(t('wallet.st.pending'), 'warning') : tx.status === 'failed' ? C.badge(t('wallet.st.failed'), 'danger') : '';
      return '<article class="admin-record"><div class="admin-record__main"><strong>' + esc(txTitle(tx)) + '</strong>' +
        (tx.note ? '<p>' + esc(t('adminCust.tx.reason', { reason: tx.note })) + '</p>' : '') +
        '<p class="admin-muted">' + esc(when(tx.created_at)) + '</p>' + (pend ? '<div class="admin-record__badges">' + pend + '</div>' : '') + '</div>' +
        '<b class="admin-tx-amt ' + (txSign(tx) === '+' ? 'is-in' : 'is-out') + '">' + txSign(tx) + esc(money(tx.amount)) + '</b></article>';
    }).join('') + '</div>' + moreBtn('wallet', n, d.transactions.length) : emptyBlock('₫', t('adminCust.wallet.empty'), t('adminCust.wallet.emptyDesc'));
    return C.card(head) + '<div class="admin-section-heading"><h2>' + esc(t('adminCust.wallet.history')) + '</h2></div>' + rows;
  }
  function tabAddresses(d) {
    if (!d.addresses.length) return emptyBlock('⌖', t('adminCust.addr.empty'), t('adminCust.addr.emptyDesc'));
    return '<div class="admin-record-list">' + d.addresses.map(function (a) {
      var who = [a.contact_name, a.contact_phone].filter(Boolean).join(' · ');
      return '<article class="admin-record"><div class="admin-record__main"><strong>' + esc(a.label || t('adminCust.addr.type.' + a.type)) + '</strong><p>' + esc(a.detail || '—') + '</p>' +
        (who ? '<p class="admin-muted">' + esc(who) + '</p>' : '') +
        '<div class="admin-record__badges">' + C.badge(t('adminCust.addr.type.' + a.type), 'info') + (a.is_default ? C.badge(t('adminCust.addr.default'), 'success') : '') + '</div></div></article>';
    }).join('') + '</div>';
  }
  function tabDevices(d) {
    var rows = d.devices.length ? '<div class="admin-record-list">' + d.devices.map(function (x) {
      return '<article class="admin-record"><div class="admin-record__main"><strong>' + esc(x.device_name || t('adminCust.dev.unknown')) + '</strong><p>' + esc(x.platform || '—') + '</p>' +
        '<p class="admin-muted">' + esc(t('adminCust.dev.lastActive', { time: x.last_active ? when(x.last_active) : '—' })) + '</p></div></article>';
    }).join('') + '</div>' : emptyBlock('▢', t('adminCust.dev.empty'), t('adminCust.dev.emptyDesc'));
    var action = '<div class="admin-actions"><button type="button" class="btn btn-secondary btn-block" data-cd="reset-devices"' + (d.devices.length ? '' : ' disabled') + '>' + esc(t('adminCust.btn.resetDevices')) + '</button></div>';
    return '<p class="admin-page-intro">' + esc(t('adminCust.dev.intro')) + '</p>' + rows + '<div class="admin-detail-gap"></div>' + C.card(action);
  }
  function detailHtml() {
    var d = detail.data, c = d.customer;
    var head = '<section class="admin-detail-head">' + TTV.screens.admin.avatarHtml(displayName(c), c.avatar_path, 'admin-detail-avatar') + '<h2>' + esc(displayName(c)) + '</h2>' +
      (c.phone ? '<span class="admin-muted">' + esc(c.phone) + '</span>' : '') + '<div class="admin-detail-badges">' + statusBadge(c) + '</div></section>';
    var note = '';
    if (isLocked(c)) {
      var parts = [];
      if (c.locked_at) parts.push(t('adminCust.lockedSince', { date: TTV.Utils.date(c.locked_at) }));
      if (c.lock_reason) parts.push(t('adminCust.lockedReason', { reason: c.lock_reason }));
      note = C.notice(parts.join(' · ') || t('adminCust.lockedNote'), t('adminCust.lockedNote'));
    }
    var tabs = '<div class="admin-chip-row" id="cd-tabs" role="group">' + TABS.map(function (k) { return chip('data-cd-tab', k, t('adminCust.tab.' + k), detail.tab === k); }).join('') + '</div>';
    var body = { profile: tabProfile, orders: tabOrders, wallet: tabWallet, addresses: tabAddresses, devices: tabDevices }[detail.tab](d);
    return '<div class="admin-detail">' + head + note + tabs + '<div id="cd-body">' + body + '</div></div>';
  }
  function paintDetail() { host.innerHTML = detailHtml(); }
  function paintBody() { // đổi tab / mở rộng danh sách: không vẽ lại đầu trang
    var body = host.querySelector('#cd-body'); if (!body) return paintDetail();
    body.innerHTML = { profile: tabProfile, orders: tabOrders, wallet: tabWallet, addresses: tabAddresses, devices: tabDevices }[detail.tab](detail.data);
    host.querySelectorAll('[data-cd-tab]').forEach(function (b) { var on = b.getAttribute('data-cd-tab') === detail.tab; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function loadDetail(my, id, keep) {
    if (!keep) host.innerHTML = C.loading();
    return TTV.api.getCustomer(id).then(function (d) {
      if (my !== token) return;
      if (!d) { host.innerHTML = C.emptyState(t('adminCust.detail.notFound'), t('adminCust.detail.notFoundDesc'), { icon: '?', label: t('adminCust.detail.back'), action: 'cd-back' }); return; }
      detail = { id: d.customer.id, data: d, tab: (keep && keep.tab) || 'profile', more: (keep && keep.more) || { orders: false, wallet: false } };
      paintDetail();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('adminCust.detail.loadError'), msg(e), { icon: '!', label: t('adminCust.retry'), action: 'cd-retry' });
    });
  }
  function renderDetail(ctx) {
    var s = TTV.auth.getSession(), my = ++token, id = ctx.params.id;
    list = null; detail = null; closeModals();
    TTV.screens.admin.shell(ctx.path, t('adminCust.detail.title'), '', s && s.role, { back: LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    host.setAttribute('data-customer-id', id);
    loadDetail(my, id);
  }

  /* ===================== Cửa sổ ===================== */
  function closeModals() { document.querySelectorAll('[data-cu-backdrop]').forEach(function (el) { el.remove(); }); modalBusy = false; }
  function openModal(title, body, footer) {
    closeModals();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-backdrop" data-cu-backdrop><section class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<header class="modal__header"><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-cu="close" aria-label="' + esc(t('adminCust.btn.close')) + '">×</button></header>' +
      '<div class="modal__body">' + body + '</div><footer class="modal__footer"><div class="admin-modal-actions">' + footer + '</div></footer></section></div>');
  }
  function btn(cls, action, label) { return '<button type="button" class="btn ' + cls + '" data-cu="' + action + '">' + esc(label) + '</button>'; }
  function setBusy(on) {
    modalBusy = on;
    document.querySelectorAll('[data-cu-backdrop] [data-cu^="confirm"]').forEach(function (b) {
      b.disabled = on;
      if (on) { b.setAttribute('data-label', b.textContent); b.textContent = t('adminCust.btn.working'); } else if (b.getAttribute('data-label')) b.textContent = b.getAttribute('data-label');
    });
  }
  function fieldErr(name, text) {
    var el = document.querySelector('[data-cu-backdrop] [data-cu-err="' + name + '"]'); if (!el) return;
    el.textContent = text || ''; el.hidden = !text;
  }

  function askLock() {
    openModal(t('adminCust.lock.title'),
      '<p class="admin-modal-text">' + esc(t('adminCust.lock.body', { name: displayName(detail.data.customer) })) + '</p>' +
      '<label class="field__label" for="cu-reason">' + esc(t('adminCust.lock.reason')) + '</label>' +
      '<textarea id="cu-reason" class="admin-textarea" maxlength="200" placeholder="' + esc(t('adminCust.lock.reasonPh')) + '"></textarea>',
      btn('btn-secondary', 'close', t('adminCust.btn.cancel')) + btn('btn-danger', 'confirm-lock', t('adminCust.lock.confirm')));
  }
  function askUnlock() {
    openModal(t('adminCust.unlock.title'), '<p class="admin-modal-text">' + esc(t('adminCust.unlock.body', { name: displayName(detail.data.customer) })) + '</p>',
      btn('btn-secondary', 'close', t('adminCust.btn.cancel')) + btn('btn-primary', 'confirm-unlock', t('adminCust.unlock.confirm')));
  }
  function askResetDevices() {
    openModal(t('adminCust.dev.resetTitle'), '<p class="admin-modal-text">' + esc(t('adminCust.dev.resetBody', { n: detail.data.devices.length })) + '</p>',
      btn('btn-secondary', 'close', t('adminCust.btn.cancel')) + btn('btn-danger', 'confirm-reset', t('adminCust.dev.resetConfirm')));
  }
  function walletBody(dir) {
    var bal = detail.data.customer.wallet_balance;
    return '<p class="admin-modal-text">' + esc(t('adminCust.wallet.modalBody', { name: displayName(detail.data.customer), balance: money(bal) })) + '</p>' +
      '<div class="admin-chip-row" id="cu-dir" role="group">' + chip('data-cu-dir', 'in', t('adminCust.wallet.in'), dir === 'in') + chip('data-cu-dir', 'out', t('adminCust.wallet.out'), dir === 'out') + '</div>' +
      '<label class="field__label" for="cu-amount">' + esc(t('adminCust.wallet.amount')) + '</label>' +
      '<input id="cu-amount" class="field" type="text" inputmode="numeric" autocomplete="off" placeholder="' + esc(t('adminCust.wallet.amountPh')) + '">' +
      '<p class="field-error" data-cu-err="amount" hidden></p>' +
      '<label class="field__label" for="cu-reason">' + esc(t('adminCust.wallet.reason')) + '</label>' +
      '<textarea id="cu-reason" class="admin-textarea" maxlength="200" placeholder="' + esc(t('adminCust.wallet.reasonPh')) + '"></textarea>' +
      '<p class="field-error" data-cu-err="reason" hidden></p>' +
      '<p class="admin-muted admin-modal-text">' + esc(t('adminCust.wallet.hint')) + '</p>';
  }
  function askWallet(dir) {
    walletDir = dir;
    openModal(t('adminCust.wallet.modalTitle'), walletBody(dir),
      btn('btn-secondary', 'close', t('adminCust.btn.cancel')) + btn('btn-primary', 'confirm-wallet', t('adminCust.wallet.confirm')));
    var a = document.getElementById('cu-amount'); if (a) a.focus();
  }

  function afterWrite(my, toastKey) {
    return loadDetail(my, detail.id, { tab: detail.tab, more: detail.more }).then(function () { closeModals(); C.toast(t(toastKey), 'success'); });
  }
  function doStatus(status) {
    if (modalBusy || !detail) return;
    var my = token, el = document.getElementById('cu-reason'), reason = el ? el.value : '';
    setBusy(true);
    TTV.api.setCustomerStatus(detail.id, status, reason).then(function () {
      if (my !== token || !detail) return;
      return afterWrite(my, status === 'locked' ? 'adminCust.toast.locked' : 'adminCust.toast.unlocked');
    }).catch(function (e) { if (my !== token) return; setBusy(false); C.toast(msg(e), 'error'); });
  }
  function doWallet() {
    if (modalBusy || !detail) return;
    var my = token, amount = document.getElementById('cu-amount'), reason = document.getElementById('cu-reason');
    fieldErr('amount', ''); fieldErr('reason', '');
    setBusy(true);
    TTV.api.adjustCustomerWallet(detail.id, { direction: walletDir, amount: amount ? amount.value : '', reason: reason ? reason.value : '' }).then(function () {
      if (my !== token || !detail) return;
      detail.tab = 'wallet';
      return afterWrite(my, walletDir === 'in' ? 'adminCust.toast.walletIn' : 'adminCust.toast.walletOut');
    }).catch(function (e) {
      if (my !== token) return;
      setBusy(false);
      if (e && e.errors) { fieldErr('amount', e.errors.amount); fieldErr('reason', e.errors.reason); if (!e.errors.amount && !e.errors.reason) C.toast(msg(e), 'error'); }
      else C.toast(msg(e), 'error');
    });
  }
  function doResetDevices() {
    if (modalBusy || !detail) return;
    var my = token; setBusy(true);
    TTV.api.resetCustomerDevices(detail.id).then(function () {
      if (my !== token || !detail) return;
      return afterWrite(my, 'adminCust.toast.devicesReset');
    }).catch(function (e) { if (my !== token) return; setBusy(false); C.toast(msg(e), 'error'); });
  }

  /* ===================== Sự kiện ===================== */
  function onClick(e) {
    var el, target = e.target;
    if (!target || !target.closest) return;
    if (target.hasAttribute('data-cu-backdrop')) { if (!modalBusy) closeModals(); return; }
    if ((el = target.closest('[data-cu-dir]'))) {
      walletDir = el.getAttribute('data-cu-dir');
      document.querySelectorAll('[data-cu-dir]').forEach(function (b) { var on = b.getAttribute('data-cu-dir') === walletDir; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      return;
    }
    if ((el = target.closest('[data-cu]'))) {
      var a = el.getAttribute('data-cu');
      if (a === 'close') { if (!modalBusy) closeModals(); return; }
      if (!detail) return;
      if (a === 'confirm-lock') doStatus('locked'); else if (a === 'confirm-unlock') doStatus('active');
      else if (a === 'confirm-wallet') doWallet(); else if (a === 'confirm-reset') doResetDevices();
      return;
    }
    if (detail && host && host.contains(target)) {
      if ((el = target.closest('[data-cd-tab]'))) { detail.tab = el.getAttribute('data-cd-tab'); paintBody(); return; }
      if ((el = target.closest('[data-cd-more]'))) { detail.more[el.getAttribute('data-cd-more')] = true; paintBody(); return; }
      if ((el = target.closest('[data-cd-order]'))) { goTo('/admin/orders/' + encodeURIComponent(el.getAttribute('data-cd-order'))); return; } // 8.2: mở chi tiết đơn
      if ((el = target.closest('[data-cd]'))) {
        var k = el.getAttribute('data-cd');
        if (k === 'lock') askLock(); else if (k === 'unlock') askUnlock();
        else if (k === 'wallet-in') askWallet('in'); else if (k === 'wallet-out') askWallet('out');
        else if (k === 'reset-devices') askResetDevices();
        return;
      }
    }
    if (list && host && host.contains(target)) {
      if ((el = target.closest('[data-cl-open]'))) { goTo(LIST + '/' + encodeURIComponent(el.getAttribute('data-cl-open'))); return; }
      if ((el = target.closest('[data-cl-status]'))) {
        list.status = el.getAttribute('data-cl-status'); list.page = 0;
        host.querySelectorAll('[data-cl-status]').forEach(function (b) { var on = b.getAttribute('data-cl-status') === list.status; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        paintResults(); return;
      }
      if ((el = target.closest('[data-cl-page]'))) { list.page += Number(el.getAttribute('data-cl-page')); paintResults(); window.scrollTo(0, 0); return; }
    }
    if (host && (el = target.closest('[data-action]'))) {
      var act = el.getAttribute('data-action');
      if (act === 'cl-retry') { loadList(token); return; }
      if (act === 'cd-retry') { loadDetail(token, host.getAttribute('data-customer-id')); return; }
      if (act === 'cd-back') goTo(LIST);
    }
  }
  function onInput(e) {
    var el = e.target;
    if (list && el && el.id === 'cl-search') { list.q = el.value; list.page = 0; paintResults(); return; }
    if (el && el.id === 'cu-amount') { // hiển thị 100.000 khi gõ
      var digits = el.value.replace(/\D/g, '').slice(0, 9);
      el.value = digits ? Number(digits).toLocaleString('vi-VN') : ''; fieldErr('amount', '');
    } else if (el && el.id === 'cu-reason') fieldErr('reason', '');
  }
  function onKeydown(e) {
    if (e.key === 'Escape' && !modalBusy && document.querySelector('[data-cu-backdrop]')) { closeModals(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var o = detail && e.target && e.target.closest && e.target.closest('[data-cd-order]');
    if (o && e.target === o) { e.preventDefault(); goTo('/admin/orders/' + encodeURIComponent(o.getAttribute('data-cd-order'))); return; }
    if (!list) return;
    var el = e.target && e.target.closest && e.target.closest('[data-cl-open]');
    if (el && e.target === el) { e.preventDefault(); goTo(LIST + '/' + encodeURIComponent(el.getAttribute('data-cl-open'))); }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);

  function destroy() { token++; list = null; detail = null; host = null; closeModals(); }

  TTV.screens.adminCustomers = { renderList: renderList, renderDetail: renderDetail, destroy: destroy };
  var opts = { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy };
  TTV.Router.add('/admin/customers', renderList, opts);
  TTV.Router.add('/admin/customers/:id', renderDetail, opts);
})(window.TTV);
