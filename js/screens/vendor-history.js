/* Lịch sử công việc (thợ) — #/vendor/history, mở từ tab Cá nhân.
   Liệt kê đơn đã HOÀN THÀNH của thợ; bấm một thẻ mở Chi tiết đơn (#/vendor/market/:id) giống "Việc của tôi". */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, PAGE = 10;
  var token = 0, rootEl = null, clickHandler = null, jobs = [], shown = PAGE;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function whenText(iso) {
    return iso ? (TTV.Utils.date(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '') : '';
  }
  function shell(inner) {
    return '<div class="vendor vo vh">' +
      '<header class="app-header"><button type="button" class="app-header__back" data-back data-back-fallback="/vendor/profile" aria-label="Quay lại">‹</button>' +
      '<h1>' + esc(t('vendorHistory.title')) + '</h1></header>' +
      '<main class="vo-main">' + inner + '</main></div>';
  }
  function cardMarkup(o) {
    var money = o.vendor_earning != null ? [t('vendorHistory.earn'), o.vendor_earning] : [t('vendorHistory.pay'), o.quote_price || o.final_price];
    return '<a class="vm-card" href="#/vendor/market/' + esc(o.id) + '">' +
      '<div class="vm-card__head">' +
        '<span class="vm-card__icon" aria-hidden="true">' + esc(o.service_icon) + '</span>' +
        '<div class="vm-card__title"><strong>' + esc(o.service_name) + '</strong>' +
          '<span>' + esc(o.code) + ' · ' + esc(t('vendorHistory.doneAt', { time: whenText(o.completed_at) })) + '</span></div>' +
        '<div class="vm-card__badges">' + C.badge(t('vendorOrder.status.completed'), 'success') + '</div>' +
      '</div>' +
      '<ul class="vm-route">' +
        '<li><i class="vm-dot vm-dot--from"></i><span>' + esc((o.pickup && o.pickup.addr) || t('vendorMarket.noAddr')) + '</span></li>' +
        '<li><i class="vm-dot vm-dot--to"></i><span>' + esc((o.dropoff && o.dropoff.addr) || t('vendorMarket.noAddr')) + '</span></li>' +
      '</ul>' +
      '<div class="vm-card__foot"><div class="vm-offer"><small>' + esc(money[0]) + '</small><b>' + esc(vnd(money[1])) + '</b></div></div></a>';
  }
  function paint() {
    if (!rootEl) return;
    if (!jobs.length) {
      rootEl.innerHTML = shell(C.emptyState(t('vendorHistory.emptyTitle'), t('vendorHistory.emptyDesc'), { icon: '☑' }));
      return;
    }
    var rows = jobs.slice(0, shown);
    rootEl.innerHTML = shell('<div class="vm-meta"><span>' + esc(t('vendorHistory.count', { n: jobs.length })) + '</span></div>' +
      '<div class="vm-list">' + rows.map(cardMarkup).join('') + '</div>' +
      (jobs.length > shown ? '<button type="button" class="btn btn-secondary btn-block vh-more" data-vh="more">' + esc(t('vendorHistory.more')) + '</button>' : ''));
  }
  function load() {
    var my = ++token;
    rootEl.innerHTML = shell(C.loading(t('common.loading')));
    TTV.api.listVendorHistory().then(function (res) {
      if (my !== token || !rootEl) return;
      jobs = (res && res.jobs) || []; shown = PAGE; paint();
    }).catch(function (err) {
      if (my !== token || !rootEl) return;
      if (err && err.code === 'LOCKED') { TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); }); return; }
      rootEl.innerHTML = shell(C.emptyState(t('vendorHistory.loadError'), (err && err.message) || t('common.error'), { icon: '!' }) +
        '<button type="button" class="btn btn-secondary btn-block" data-vh="retry">' + esc(t('vendorHistory.retry')) + '</button>');
    });
  }
  function onClick(e) {
    var el = e.target.closest('[data-vh]'); if (!el || !rootEl || !rootEl.contains(el)) return;
    if (el.getAttribute('data-vh') === 'more') { shown += PAGE; paint(); } else load();
  }
  function render() {
    destroy();
    rootEl = app();
    clickHandler = onClick; rootEl.addEventListener('click', clickHandler);
    load();
  }
  function destroy() {
    token++; jobs = [];
    if (rootEl && clickHandler) rootEl.removeEventListener('click', clickHandler);
    rootEl = null; clickHandler = null;
  }

  TTV.screens.vendorHistory = { render: render, destroy: destroy };
  TTV.Router.add('/vendor/history', render, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: destroy });
})(window.TTV);
