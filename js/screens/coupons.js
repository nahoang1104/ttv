/* Mã giảm giá — #/coupons (task 7.4). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  var rootEl = null, box = null, catalog = [];
  var data = { available: [], used: [], expired: [] };
  var tab = 'available', status = 'loading', busy = false, token = 0;
  var ICON_PCT = '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" d="M12 3.4l2 1.5 2.5-.2 1 2.3 2.2 1.2-.4 2.5 1.2 2.2-1.6 2 .1 2.5-2.4.9-1.5 2-2.4-.8-2.4.8-1.5-2-2.4-.9.1-2.5-1.6-2 1.2-2.2-.4-2.5 2.2-1.2 1-2.3 2.5.2z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M9.2 14.8l5.6-5.6"/><circle cx="9.4" cy="9.6" r="1" fill="currentColor"/><circle cx="14.6" cy="14.4" r="1" fill="currentColor"/></svg>';

  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function money(n) { return TTV.Utils.money(n || 0); }
  function dateOf(iso) { return TTV.Utils.date(iso, { hour: '2-digit', minute: '2-digit', hour12: false }) || '—'; }
  function closeSheets() { document.querySelectorAll('.sheet-backdrop').forEach(function (el) { el.remove(); }); }

  function offLine(c) {
    return c.discount_type === 'fixed'
      ? t('coupon.offFixed', { n: money(c.discount_value) })
      : t('coupon.offPct', { n: String(c.discount_value).replace('.', ',') });
  }
  function capAmount(c) {
    if (c.discount_type === 'fixed') return money(c.discount_value);
    return c.max_discount ? money(c.max_discount) : '';
  }
  function metaBits(c) {
    var bits = [t('coupon.offerForMin', { off: offLine(c), amount: money(c.min_order || 0) })];
    if (c.discount_type !== 'fixed' && c.max_discount) bits.push(t('coupon.cap', { n: money(c.max_discount) }));
    return bits;
  }
  function serviceLabel(c) {
    var codes = Array.isArray(c.services) ? c.services.map(String) : [];
    if (!codes.length) return t('coupon.servicesAll');
    var names = catalog.filter(function (s) { return codes.indexOf(String(s.code || s.id)) >= 0; })
      .map(function (s) { return s.name || s.code; });
    return names.length ? names.join(', ') : codes.join(', ');
  }
  function remainLeft(iso) {
    var at = new Date(iso).getTime(), ms = at - Date.now();
    if (!isFinite(at)) return t('coupon.afterNone');
    if (ms <= 0) return t('coupon.expiredTag');
    var d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000);
    if (d >= 1) return t('coupon.afterDays', { n: d });
    if (h >= 1) return t('coupon.afterHours', { n: h });
    return t('coupon.afterSoon');
  }
  function remainText(c, kind) {
    if (kind === 'used') return t('coupon.tab.used');
    if (kind === 'expired') return t('coupon.expiredTag');
    return t('coupon.remain', { left: remainLeft(c.expires_at) });
  }
  function findCoupon(code) {
    return data.available.concat(data.used, data.expired).filter(function (c) { return c.code === code; })[0];
  }
  function copyCode(code) {
    var done = function () { C.toast(t('coupon.copied', { code: code }), 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(done); return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = code; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    } catch (_) {}
    done();
  }
  function showDetail(c) {
    closeSheets();
    var cap = capAmount(c);
    var rows = [
      [t('coupon.detail.code'), c.code],
      [t('coupon.detail.title'), c.title || c.code],
      [t('coupon.detail.condition'), c.condition || '—'],
      cap ? [t('coupon.detail.cap'), cap] : null,
      [t('coupon.detail.minWorkers'), t('coupon.minWorkers', { n: c.min_workers })],
      [t('coupon.detail.services'), serviceLabel(c)],
      [t('coupon.detail.expires'), dateOf(c.expires_at)]
    ].filter(Boolean);
    var body = '<dl class="cp-kv">' + rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('') + '</dl>';
    document.body.insertAdjacentHTML('beforeend', C.sheet(t('coupon.detail.titleSheet'), body, {
      footer: '<button type="button" class="btn btn-primary" data-cp="copy" data-cp-code="' + esc(c.code) + '">' + esc(t('coupon.copy')) + '</button>'
    }));
  }

  function cardHtml(c, kind) {
    var badge = kind === 'used' ? t('coupon.tab.used') : kind === 'expired' ? t('coupon.expiredTag') : t('coupon.badge');
    var ico = c.image_path ? '<img src="' + esc(c.image_path) + '" alt="" loading="lazy">' : ICON_PCT;
    return '<article class="cp-ticket cp-ticket--' + kind + '">' +
      '<div class="cp-ticket__stub' + (c.image_path ? ' is-photo' : '') + '">' + ico +
      (c.image_path ? '' : '<span>' + esc(t('coupon.brand')) + '</span>') + '</div>' +
      '<div class="cp-ticket__main">' +
        '<div class="cp-ticket__top"><h3>' + esc(c.title || c.code) + '</h3>' +
        '<span class="cp-ticket__badge">' + esc(badge) + '</span></div>' +
        '<p class="cp-ticket__meta">' + metaBits(c).map(esc).join('<br>') + '</p>' +
        '<p class="cp-ticket__remain">' + esc(remainText(c, kind)) + '</p>' +
        '<div class="cp-ticket__foot">' +
          '<button type="button" class="cp-ticket__more" data-cp="detail" data-cp-code="' + esc(c.code) + '">' + esc(t('coupon.more')) + '</button>' +
          '<button type="button" class="cp-ticket__copy" data-cp="copy" data-cp-code="' + esc(c.code) + '">' + esc(t('coupon.copy')) + '</button>' +
        '</div></div></article>';
  }
  function emptyHtml(title, desc) {
    var art = '<svg viewBox="0 0 120 100" width="120" height="100" aria-hidden="true"><g fill="none" stroke="#2b8cf0" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M16 52l44 14 44-14v30L60 96 16 82z" fill="#eaf4ff"/><path d="M16 52l-4-18 28 8M104 52l4-18-28 8M60 66v30"/><rect x="42" y="16" width="34" height="42" rx="3" transform="rotate(-6 59 37)" fill="#fff"/><path d="M52 38l14-14M52 26.5h.1M66 37.5h.1"/></g><path d="M20 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM100 14l1.4 3.4 3.4 1.4-3.4 1.4L100 24l-1.4-3.4-3.4-1.4 3.4-1.4z" fill="#8fc4f7"/></svg>';
    return '<section class="cp-empty">' + art + '<h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p></section>';
  }
  function listHtml() {
    if (status === 'loading') return C.loading(t('common.loading'));
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
  function load() {
    var my = ++token;
    status = 'loading';
    paintBody();
    Promise.all([TTV.api.listMyCoupons(), TTV.api.listServices()]).then(function (pack) {
      if (my !== token || !rootEl) return;
      data = pack[0] || { available: [], used: [], expired: [] };
      catalog = pack[1] || [];
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
      C.toast((err && err.message) || t('common.error'), 'danger');
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
    else if (key === 'copy') { var code = act.getAttribute('data-cp-code'); if (code) copyCode(code); }
    else if (key === 'detail') { var row = findCoupon(act.getAttribute('data-cp-code')); if (row) showDetail(row); }
  }

  document.addEventListener('click', onClick);
  TTV.screens.coupons = {
    render: function (container) {
      rootEl = container; tab = 'available'; busy = false;
      data = { available: [], used: [], expired: [] }; catalog = [];
      paint(); load();
    },
    destroy: function () {
      token++; closeSheets(); rootEl = null; box = null;
    }
  };
})(window.TTV);
