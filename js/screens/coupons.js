/* Mã giảm giá — #/coupons (task 7.4). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  var Ticket = TTV.ui.couponTicket;
  var rootEl = null, box = null, catalog = [];
  var data = { available: [], used: [], expired: [] };
  var tab = 'available', status = 'loading', busy = false, token = 0;
  var lastStamp = '', unwatch = null;

  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function closeSheets() { document.querySelectorAll('.sheet-backdrop').forEach(function (el) { el.remove(); }); }
  function remember() {
    Ticket.setCatalog(catalog);
    Ticket.remember((data.available || []).concat(data.used || [], data.expired || []));
  }
  function listHtml() {
    if (status === 'loading') return C.loading(t('common.loading'));
    if (status === 'error') {
      return Ticket.empty(t('common.error'), t('coupon.loadError')) +
        '<button type="button" class="btn btn-secondary cp-retry" data-cp="retry">' + esc(t('address.retry')) + '</button>';
    }
    var list = data[tab] || [];
    if (!list.length) return Ticket.empty(t('coupon.empty.' + tab + '.title'), t('coupon.empty.' + tab + '.desc'));
    return list.map(function (c) { return Ticket.card(c, tab); }).join('');
  }
  function tabsHtml() {
    return '<div class="cp-tabs" role="tablist">' + ['available', 'used', 'expired'].map(function (id) {
      return '<button type="button" role="tab" class="cp-tab' + (tab === id ? ' is-on' : '') + '" data-cp-tab="' + id + '" aria-selected="' + (tab === id) + '">' + esc(t('coupon.tab.' + id)) + '</button>';
    }).join('') + '</div>';
  }
  function paintBody() {
    if (!box) return;
    remember();
    var tabsEl = box.querySelector('[data-cp-tabs]'), listEl = box.querySelector('[data-cp-list]');
    if (tabsEl) tabsEl.innerHTML = tabsHtml();
    if (listEl) listEl.innerHTML = listHtml();
  }
  function paint() {
    if (!rootEl) return;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML = '<div class="cp">' + C.header(t('coupon.title'), { back: true }) +
      '<main class="cp-page">' +
        '<section class="cp-enter"><label for="cp-code">' + esc(t('coupon.enter')) + '</label>' +
          '<div class="cp-enter__row">' +
            '<input id="cp-code" type="text" data-cp-code maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="' + esc(t('coupon.placeholder')) + '">' +
            '<button type="button" class="btn btn-primary cp-apply" data-cp="apply">' + esc(t('coupon.apply')) + '</button>' +
          '</div></section>' +
        '<div data-cp-tabs>' + tabsHtml() + '</div>' +
        '<div class="cp-list" data-cp-list>' + listHtml() + '</div>' +
      '</main></div>';
    box = rootEl.querySelector('.cp');
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.hasAttribute('data-cp-code')) { e.preventDefault(); apply(); }
    });
    box.addEventListener('input', function (e) {
      if (e.target.hasAttribute('data-cp-code')) e.target.value = e.target.value.toUpperCase().replace(/\s+/g, '');
    });
  }
  function listSig(pack) {
    function ids(arr) { return (arr || []).map(function (c) { return String(c.code || ''); }).join(','); }
    return ids(pack.available) + '|' + ids(pack.used) + '|' + ids(pack.expired);
  }
  function load(silent) {
    var my = ++token;
    if (!silent) { status = 'loading'; paintBody(); }
    var req = silent
      ? TTV.api.listMyCoupons({ poll: true, since: lastStamp }).then(function (x) { return [x, catalog]; })
      : Promise.all([TTV.api.listMyCoupons(), TTV.api.listServices()]);
    req.then(function (pack) {
      if (my !== token || !rootEl) return;
      var next = pack[0] || { available: [], used: [], expired: [] };
      if (next.unchanged) return;
      if (next.stamp) lastStamp = next.stamp;
      var same = silent && status === 'ready' && listSig(data) === listSig(next);
      data = next;
      if (!silent && pack[1]) catalog = pack[1] || [];
      status = 'ready';
      if (!same) paintBody();
      if (!unwatch && TTV.Live && TTV.Live.watch) {
        unwatch = TTV.Live.watch('promo', function () { load(true); }, { immediate: false });
      }
    }).catch(function () {
      if (my !== token || !rootEl) return;
      if (silent && status === 'ready') return;
      status = 'error';
      paintBody();
    });
  }
  function apply() {
    if (busy || !box) return;
    var input = box.querySelector('[data-cp-code]'), btn = box.querySelector('[data-cp="apply"]');
    busy = true;
    if (btn) btn.disabled = true;
    TTV.api.claimCoupon(input ? input.value : '').then(function (c) {
      if (!rootEl) return;
      C.toast(t('coupon.added', { code: c.code }), 'success');
      if (input) input.value = '';
      tab = 'available';
      load();
    }).catch(function (err) {
      var msg = (err && err.code === 'COUPON_SOLD_OUT') ? t('coupon.soldOut') : ((err && err.message) || t('common.error'));
      C.toast(msg, 'danger');
    }).then(function () {
      busy = false;
      if (btn) btn.disabled = false;
    });
  }
  function onClick(e) {
    if (!rootEl || !e.target.closest) return;
    var tb = e.target.closest('[data-cp-tab]');
    if (tb) {
      if (box && box.contains(tb)) { tab = tb.getAttribute('data-cp-tab'); paintBody(); }
      return;
    }
    var act = e.target.closest('[data-cp]');
    if (!act) return;
    if (box && !box.contains(act) && !act.closest('.sheet-backdrop')) return;
    var key = act.getAttribute('data-cp');
    if (key === 'apply') apply();
    else if (key === 'retry') load();
  }

  document.addEventListener('click', onClick);
  TTV.screens.coupons = {
    render: function (container) {
      if (unwatch) { unwatch(); unwatch = null; }
      rootEl = container; tab = 'available'; busy = false; lastStamp = '';
      data = { available: [], used: [], expired: [] }; catalog = [];
      paint(); load();
    },
    destroy: function () {
      token++; closeSheets();
      if (unwatch) { unwatch(); unwatch = null; }
      rootEl = null; box = null;
    }
  };
})(window.TTV);
