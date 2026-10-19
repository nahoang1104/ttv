/* Đánh giá thợ nhận được — #/vendor/reviews (xem + phản hồi). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var rootEl = null, token = 0, data = null;

  function t(key, p) { return TTV.I18n.t(key, p); }
  function esc(v) { return C.escape(v); }
  function starRow(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '☆';
    return s;
  }
  function cardHtml(it) {
    var r = it.review || {};
    return '<article class="vr-card" data-vr-id="' + esc(r.id) + '">' +
      '<div class="vr-card__top"><strong>' + esc(it.customer_name) + '</strong>' +
        '<span class="vr-stars">' + esc(starRow(r.rating)) + '</span></div>' +
      '<p class="vr-meta">' + esc(it.order_code) + (it.completed_at ? ' · ' + esc(TTV.Utils.date(it.completed_at)) : '') + '</p>' +
      (r.comment ? '<p class="vr-body">“' + esc(r.comment) + '”</p>' : '') +
      (r.vendor_reply
        ? '<p class="vr-reply">' + esc(t('vendorReviews.replied', { text: r.vendor_reply })) + '</p>'
        : '<button type="button" class="btn btn-secondary btn-block" data-vr-open>' + esc(t('vendorReviews.reply')) + '</button>') +
    '</article>';
  }
  function paint() {
    if (!rootEl || !data) return;
    var list = data.reviews || [];
    rootEl.innerHTML = C.header(t('vendorReviews.title')) +
      '<main class="page vr-list">' +
        (list.length ? list.map(cardHtml).join('') : C.emptyState(t('vendorReviews.empty.title'), t('vendorReviews.empty.desc'), { icon: '★' })) +
      '</main>';
  }
  function openReply(id) {
    var card = rootEl.querySelector('[data-vr-id="' + id + '"]');
    if (!card || card.querySelector('[data-vr-box]')) return;
    card.insertAdjacentHTML('beforeend',
      '<div class="vr-box" data-vr-box>' +
        '<textarea maxlength="500" rows="3" placeholder="' + esc(t('vendorReviews.ph')) + '"></textarea>' +
        '<button type="button" class="btn btn-primary btn-block" data-vr-send>' + esc(t('vendorReviews.send')) + '</button>' +
      '</div>');
  }
  function onClick(e) {
    var open = e.target.closest('[data-vr-open]');
    if (open) {
      var card = open.closest('[data-vr-id]');
      if (card) openReply(card.getAttribute('data-vr-id'));
      return;
    }
    var send = e.target.closest('[data-vr-send]');
    if (!send) return;
    var wrap = send.closest('[data-vr-id]');
    var ta = wrap && wrap.querySelector('textarea');
    send.disabled = true;
    TTV.api.replyVendorReview(wrap.getAttribute('data-vr-id'), ta ? ta.value : '').then(function () {
      TTV.Components.toast(t('vendorReviews.sent'), 'success');
      load();
    }).catch(function (err) {
      send.disabled = false;
      TTV.Components.toast((err && err.message) || t('common.error'), 'danger');
    });
  }
  function load() {
    var my = ++token;
    rootEl.innerHTML = C.header(t('vendorReviews.title')) + '<main class="page">' + C.loading(t('common.loading')) + '</main>';
    TTV.api.listVendorReviews().then(function (res) {
      if (my !== token || !rootEl) return;
      data = res;
      paint();
    }).catch(function (err) {
      if (my !== token || !rootEl) return;
      rootEl.innerHTML = C.header(t('vendorReviews.title')) + '<main class="page">' +
        C.emptyState(t('vendorReviews.err'), (err && err.message) || '', { icon: '!' }) + '</main>';
    });
  }
  function render(container) {
    destroy();
    rootEl = container;
    rootEl.addEventListener('click', onClick);
    load();
  }
  function destroy() {
    token++;
    data = null;
    if (rootEl) rootEl.removeEventListener('click', onClick);
    rootEl = null;
  }

  TTV.screens.vendorReviews = { render: render, destroy: destroy };
  TTV.Router.add('/vendor/reviews', function () {
    TTV.screens.vendorReviews.render(document.getElementById('app'));
  }, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: function () { TTV.screens.vendorReviews.destroy(); } });
})(window.TTV);
