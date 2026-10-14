/* Mã giảm giá — #/coupons (task 7.4). Bám docs/reference/10-ma-giam-gia-*.jpg */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var box = null;
  var data = { available: [], used: [], expired: [] };
  var tab = 'available';
  var status = 'loading'; // loading | ready | error
  var busy = false;
  var token = 0;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function money(n) { return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(n) || 0) + 'đ'; }
  function dateOf(iso) { return TTV.I18n && TTV.Utils && TTV.Utils.date ? TTV.Utils.date(iso) : String(iso || '').slice(0, 10); }

  var ICON_PCT = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" d="M12 3.4l2 1.5 2.5-.2 1 2.3 2.2 1.2-.4 2.5 1.2 2.2-1.6 2 .1 2.5-2.4.9-1.5 2-2.4-.8-2.4.8-1.5-2-2.4-.9.1-2.5-1.6-2 1.2-2.2-.4-2.5 2.2-1.2 1-2.3 2.5.2z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M9.2 14.8l5.6-5.6"/><circle cx="9.4" cy="9.6" r="1" fill="currentColor"/><circle cx="14.6" cy="14.4" r="1" fill="currentColor"/></svg>';
  var ICON_CAL = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4.5 10h15M8.5 3.8v3M15.5 3.8v3"/></svg>';

  function cardHtml(c, kind) {
    var cond = c.min_order > 0 ? t('coupon.minOrder', { amount: money(c.min_order) }) : t('coupon.noMin');
    var tag = '';
    if (kind === 'used') tag = '<span class="cp-tag cp-tag--off">' + esc(t('coupon.tab.used')) + '</span>';
    else if (kind === 'expired') tag = '<span class="cp-tag cp-tag--off">' + esc(t('coupon.expiredTag')) + '</span>';
    else tag = '<span class="cp-tag">' + esc(c.code) + '</span>';
    return '<article class="cp-card cp-card--' + kind + '">' +
      '<div class="cp-card__ico">' + ICON_PCT + '</div>' +
      '<div class="cp-card__body">' +
        '<h3>' + esc(c.title) + '</h3>' +
        '<p>' + esc(cond) + '</p>' +
        (c.min_workers > 1 ? '<p class="cp-card__hint">' + esc(t('coupon.minWorkers', { n: c.min_workers })) + '</p>' : '') +
        '<div class="cp-card__foot"><span class="cp-card__date">' + ICON_CAL + ' ' + esc(t('coupon.expiry', { date: dateOf(c.expires_at) })) + '</span>' + tag + '</div>' +
      '</div>' +
    '</article>';
  }

  function emptyHtml(title, desc) {
    var art = '<svg viewBox="0 0 120 100" width="120" height="100" aria-hidden="true"><g fill="none" stroke="#2b8cf0" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M16 52l44 14 44-14v30L60 96 16 82z" fill="#eaf4ff"/><path d="M16 52l-4-18 28 8M104 52l4-18-28 8M60 66v30"/><rect x="42" y="16" width="34" height="42" rx="3" transform="rotate(-6 59 37)" fill="#fff"/><path d="M52 38l14-14M52 26.5h.1M66 37.5h.1"/></g><path d="M20 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM100 14l1.4 3.4 3.4 1.4-3.4 1.4L100 24l-1.4-3.4-3.4-1.4 3.4-1.4z" fill="#8fc4f7"/></svg>';
    return '<section class="cp-empty">' + art + '<h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p></section>';
  }

  function listHtml() {
    if (status === 'loading') return TTV.Components.loading(t('common.loading'));
    if (status === 'error') {
      return emptyHtml(t('common.error'), t('coupon.loadError')) +
        '<button type="button" class="btn btn-secondary cp-retry" data-cp="retry">' + esc(t('address.retry')) + '</button>';
    }
    var list = data[tab] || [];
    if (!list.length) return emptyHtml(t('coupon.empty.' + tab + '.title'), t('coupon.empty.' + tab + '.desc'));
    return list.map(function (c) { return cardHtml(c, tab); }).join('');
  }

  function tabsHtml() {
    return '<div class="cp-tabs" role="tablist">' + ['available', 'used', 'expired'].map(function (id) {
      return '<button type="button" role="tab" class="cp-tab' + (tab === id ? ' is-on' : '') + '" data-cp-tab="' + id + '" aria-selected="' + (tab === id) + '">' + esc(t('coupon.tab.' + id)) + '</button>';
    }).join('') + '</div>';
  }

  function paintBody() {
    if (!box) return;
    var tabsEl = box.querySelector('[data-cp-tabs]');
    var listEl = box.querySelector('[data-cp-list]');
    if (tabsEl) tabsEl.innerHTML = tabsHtml();
    if (listEl) listEl.innerHTML = listHtml();
  }

  function paint() {
    if (!rootEl) return;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML = '<div class="cp">' +
      TTV.Components.header(t('coupon.title'), { back: true }) +
      '<main class="cp-page">' +
        '<section class="cp-enter"><label for="cp-code">' + esc(t('coupon.enter')) + '</label>' +
          '<div class="cp-enter__row">' +
            '<input id="cp-code" type="text" data-cp-code maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="' + esc(t('coupon.placeholder')) + '">' +
            '<button type="button" class="btn btn-primary cp-apply" data-cp="apply">' + esc(t('coupon.apply')) + '</button>' +
          '</div></section>' +
        TTV.Components.notice(t('coupon.notice')) +
        '<div data-cp-tabs>' + tabsHtml() + '</div>' +
        '<div class="cp-list" data-cp-list>' + listHtml() + '</div>' +
      '</main></div>';
    box = rootEl.querySelector('.cp');
    box.addEventListener('click', onClick);
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.hasAttribute('data-cp-code')) { e.preventDefault(); apply(); }
    });
    box.addEventListener('input', function (e) {
      if (e.target.hasAttribute('data-cp-code')) e.target.value = e.target.value.toUpperCase().replace(/\s+/g, '');
    });
  }

  function load() {
    var my = ++token;
    status = 'loading';
    paintBody();
    TTV.api.listMyCoupons().then(function (res) {
      if (my !== token || !rootEl) return;
      data = res || { available: [], used: [], expired: [] };
      status = 'ready';
      paintBody();
    }).catch(function () {
      if (my !== token || !rootEl) return;
      status = 'error';
      paintBody();
    });
  }

  function apply() {
    if (busy || !box) return;
    var input = box.querySelector('[data-cp-code]');
    var btn = box.querySelector('[data-cp="apply"]');
    var code = input ? input.value : '';
    busy = true;
    if (btn) btn.disabled = true;
    TTV.api.claimCoupon(code).then(function (c) {
      if (!rootEl) return;
      TTV.Components.toast(t('coupon.added', { code: c.code }), 'success');
      if (input) input.value = '';
      tab = 'available';
      load();
    }).catch(function (err) {
      TTV.Components.toast((err && err.message) || t('common.error'), 'danger');
    }).then(function () {
      busy = false;
      if (btn) btn.disabled = false;
    });
  }

  function onClick(e) {
    var tb = e.target.closest('[data-cp-tab]');
    if (tb) { tab = tb.getAttribute('data-cp-tab'); paintBody(); return; }
    var act = e.target.closest('[data-cp]');
    if (!act) return;
    var key = act.getAttribute('data-cp');
    if (key === 'apply') apply();
    if (key === 'retry') load();
  }

  TTV.screens.coupons = {
    render: function (container) {
      rootEl = container;
      tab = 'available';
      data = { available: [], used: [], expired: [] };
      busy = false;
      paint();
      load();
    },
    destroy: function () {
      token++;
      rootEl = null;
      box = null;
    }
  };
})(window.TTV);
