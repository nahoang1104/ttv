/* Báo giá của tôi (thợ) — #/vendor/quotes, mở từ tab Cá nhân (task 5.7).
   4 tab: Chờ chọn / Được chọn / Không được chọn / Hết hạn. Gồm báo giá của mọi đơn (1 thợ lẫn ≥ 2 thợ).
   Bấm thẻ "Chờ chọn" → Chi tiết đơn (#/vendor/market/:id) để sửa/rút báo giá (5.4);
   thẻ "Được chọn" → cùng màn chi tiết (đơn của chính thợ). Các nhóm còn lại chỉ để xem lại.
   Báo giá đã rút bị ẩn hẳn (không hiện ở tab nào). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, PAGE = 10;
  var TABS = ['pending', 'accepted', 'rejected', 'expired'];
  // tab đang xem được giữ khi quay lại từ Chi tiết đơn (không reset trong destroy)
  var tab = 'pending';
  var token = 0, rootEl = null, clickHandler = null, data = null, shown = PAGE;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function kmText(km) { return (Math.round(Number(km) * 100) / 100).toString().replace('.', ',') + ' km'; }

  function shell(inner) {
    return '<div class="vendor vo mq">' +
      '<header class="app-header"><button type="button" class="app-header__back" data-back data-back-fallback="/vendor/profile" aria-label="Quay lại">‹</button>' +
      '<h1>' + esc(t('vendorQuotes.title')) + '</h1></header>' +
      '<main class="vo-main">' + inner + '</main></div>';
  }

  // Nhãn + màu của thẻ theo nhóm
  function badgeOf(q) {
    if (q.group === 'pending') return C.badge(t('vendorQuotes.status.pending'), 'warning');
    if (q.group === 'accepted') return C.badge(t('vendorQuotes.status.accepted'), 'success');
    if (q.group === 'rejected') return C.badge(t('vendorQuotes.status.rejected'), 'neutral');
    return C.badge(t('vendorQuotes.status.expired'), 'neutral');
  }
  // Dòng ghi chú bên phải chân thẻ
  function noteOf(q) {
    if (q.group === 'pending') {
      var min = Math.ceil((q.deadline - Date.now()) / 60000);
      return min > 0 ? t('vendorQuotes.left', { n: min }) : t('vendorQuotes.leftLess');
    }
    if (q.group === 'accepted') return q.order_status ? t('vendorOrder.status.' + q.order_status) : '';
    if (q.group === 'rejected') return t('vendorQuotes.orderTaken');
    if (q.order_missing) return t('vendorQuotes.orderGone');
    if (q.order_status === 'cancelled') return t('vendorQuotes.orderCancelled');
    return t('vendorQuotes.status.expired');
  }
  function cardMarkup(q) {
    var chips = [];
    if (q.distance_km > 0) chips.push(kmText(q.distance_km));
    chips.push(t('vendorMarket.workers', { n: q.workers }));
    if (q.eta_min > 0) chips.push(t('vendorQuotes.eta', { n: q.eta_min }));
    var inner =
      '<div class="vm-card__head">' +
        '<span class="vm-card__icon" aria-hidden="true">' + esc(q.service_icon) + '</span>' +
        '<div class="vm-card__title"><strong>' + esc(q.service_name || t('vendorMarket.noAddr')) + '</strong>' +
          '<span>' + esc(q.code) + ' · ' + esc(t('vendorQuotes.sentAt', { time: TTV.Utils.relativeTime(q.updated_at || q.created_at) })) + '</span></div>' +
        '<div class="vm-card__badges">' + badgeOf(q) + '</div>' +
      '</div>' +
      '<ul class="vm-route">' +
        '<li><i class="vm-dot vm-dot--from"></i><span>' + esc((q.pickup && q.pickup.addr) || t('vendorMarket.noAddr')) + '</span></li>' +
        '<li><i class="vm-dot vm-dot--to"></i><span>' + esc((q.dropoff && q.dropoff.addr) || t('vendorMarket.noAddr')) + '</span></li>' +
      '</ul>' +
      '<div class="vm-chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
      (q.message ? '<p class="mq-msg">' + esc(t('vendorQuotes.msg', { text: q.message })) + '</p>' : '') +
      '<div class="vm-card__foot">' +
        '<div class="vm-offer"><small>' + esc(t('vendorQuotes.myPrice')) + '</small><b>' + esc(vnd(q.price)) + '</b>' +
          (q.user_offer > 0 ? '<small class="mq-cap">' + esc(t('vendorQuotes.maxPrice', { price: vnd(q.user_offer) })) + '</small>' : '') + '</div>' +
        '<span class="mq-note mq-note--' + esc(q.group) + '">' + esc(noteOf(q)) + '</span>' +
      '</div>';
    return q.can_open
      ? '<a class="vm-card" href="#/vendor/market/' + esc(q.order_id) + '">' + inner + '</a>'
      : '<div class="vm-card mq-static">' + inner + '</div>';
  }

  function tabsMarkup() {
    var counts = (data && data.counts) || {};
    return '<div class="mq-tabs" role="tablist">' + TABS.map(function (id) {
      var n = counts[id] || 0;
      return '<button type="button" class="jobs-tab' + (tab === id ? ' is-on' : '') + '" role="tab" aria-selected="' + (tab === id) + '" data-vqs-tab="' + id + '">' +
        esc(t('vendorQuotes.tab.' + id)) + (n ? ' (' + n + ')' : '') + '</button>';
    }).join('') + '</div>';
  }
  function paint() {
    if (!rootEl || !data) return;
    var list = (data.quotes || []).filter(function (q) { return q.group === tab; });
    var body;
    if (!list.length) {
      body = C.emptyState(t('vendorQuotes.empty.' + tab), t('vendorQuotes.empty.desc'), { icon: '₫' });
    } else {
      body = '<div class="vm-meta"><span>' + esc(t('vendorQuotes.count', { n: list.length })) + '</span>' +
          '<button type="button" class="link-btn" data-vqs="refresh">' + esc(t('vendorQuotes.refresh')) + '</button></div>' +
        '<p class="mq-hint">' + esc(t('vendorQuotes.hint.' + tab)) + '</p>' +
        '<div class="vm-list">' + list.slice(0, shown).map(cardMarkup).join('') + '</div>' +
        (list.length > shown ? '<button type="button" class="btn btn-secondary btn-block vh-more" data-vqs="more">' + esc(t('vendorQuotes.more')) + '</button>' : '');
    }
    var prev = rootEl.querySelector('.mq-tabs');
    var scroll = prev ? prev.scrollLeft : 0;
    rootEl.innerHTML = shell(tabsMarkup() + body);
    var now = rootEl.querySelector('.mq-tabs');
    if (now) now.scrollLeft = scroll;
  }
  function load(opts) {
    var my = ++token;
    if (!data) rootEl.innerHTML = shell(C.loading(t('common.loading')));
    TTV.api.listMyQuotes(opts || {}).then(function (res) {
      if (my !== token || !rootEl) return;
      if (res && res.unchanged) return;
      data = res || { quotes: [], counts: {} }; paint();
    }).catch(function (err) {
      if (my !== token || !rootEl) return;
      if (err && err.code === 'LOCKED') { TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); }); return; }
      data = null;
      rootEl.innerHTML = shell(C.emptyState(t('vendorQuotes.loadError'), (err && err.message) || t('common.error'), { icon: '!' }) +
        '<button type="button" class="btn btn-secondary btn-block" data-vqs="retry">' + esc(t('vendorQuotes.retry')) + '</button>');
    });
  }
  function onClick(e) {
    if (!rootEl) return;
    var tb = e.target.closest('[data-vqs-tab]');
    if (tb && rootEl.contains(tb)) {
      var id = tb.getAttribute('data-vqs-tab');
      if (id !== tab) { tab = id; shown = PAGE; paint(); }
      return;
    }
    var el = e.target.closest('[data-vqs]'); if (!el || !rootEl.contains(el)) return;
    var act = el.getAttribute('data-vqs');
    if (act === 'more') { shown += PAGE; paint(); }
    else { shown = PAGE; load({ full: true }); } // refresh / retry
  }
  function render() {
    destroy();
    rootEl = app(); data = null; shown = PAGE;
    clickHandler = onClick; rootEl.addEventListener('click', clickHandler);
    load();
  }
  function destroy() {
    token++; data = null;
    if (rootEl && clickHandler) rootEl.removeEventListener('click', clickHandler);
    rootEl = null; clickHandler = null;
  }

  TTV.screens.vendorQuotes = { render: render, destroy: destroy };
  TTV.Router.add('/vendor/quotes', render, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: destroy });
})(window.TTV);
