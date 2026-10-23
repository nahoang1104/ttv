/* Thẻ vé + chi tiết mã giảm giá — dùng chung màn Cá nhân và form đặt đơn. */
window.TTV = window.TTV || {};
TTV.ui = TTV.ui || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  var catalog = [];
  var known = [];
  var ICON_PCT = '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" d="M12 3.4l2 1.5 2.5-.2 1 2.3 2.2 1.2-.4 2.5 1.2 2.2-1.6 2 .1 2.5-2.4.9-1.5 2-2.4-.8-2.4.8-1.5-2-2.4-.9.1-2.5-1.6-2 1.2-2.2-.4-2.5 2.2-1.2 1-2.3 2.5.2z"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M9.2 14.8l5.6-5.6"/><circle cx="9.4" cy="9.6" r="1" fill="currentColor"/><circle cx="14.6" cy="14.4" r="1" fill="currentColor"/></svg>';

  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function money(n) { return TTV.Utils.money(n || 0); }
  function dateOf(iso) { return TTV.Utils.date(iso, { hour: '2-digit', minute: '2-digit', hour12: false }) || '—'; }
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
  function pickedFacts(c) {
    var bits = [offLine(c)];
    if ((Number(c.min_order) || 0) > 0) bits.push(t('coupon.minFrom', { amount: money(c.min_order) }));
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
  function find(code) {
    var key = String(code || '');
    return known.filter(function (c) { return String(c.code) === key; })[0];
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
  function closeDetail() {
    document.querySelectorAll('.sheet-backdrop[data-cp-detail]').forEach(function (el) { el.remove(); });
  }
  function showDetail(c) {
    if (!c) return;
    closeDetail();
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
    var bd = document.querySelector('.sheet-backdrop:last-of-type');
    if (bd) bd.setAttribute('data-cp-detail', '');
  }
  function cardHtml(c, kind, opts) {
    opts = opts || {};
    kind = kind || 'available';
    var badge = kind === 'used' ? t('coupon.tab.used') : kind === 'expired' ? t('coupon.expiredTag') : t('coupon.badge');
    var photo = String(c.image_path || '').replace(/\\/g, '/');
    var picked = opts.picked && opts.picked === c.code;
    var off = !!opts.disabled;
    var right = opts.pick
      ? (off ? '' : '<button type="button" class="cp-tix__btn cp-tix__btn--pick" data-pick-coupon="' + esc(c.code) + '">' + esc(t('order.coupon.use')) + '</button>')
      : '<button type="button" class="cp-tix__btn" data-cp="copy" data-cp-code="' + esc(c.code) + '">' + esc(t('coupon.copy')) + '</button>';
    var art = photo
      ? '<img src="' + esc(photo) + '" alt="">'
      : '<span class="cp-tix__mark">' + ICON_PCT + '<b>' + esc(t('coupon.brand')) + '</b></span>';
    return '<article class="cp-tix cp-tix--' + kind + (picked && !off ? ' is-picked' : '') + (off ? ' is-off' : '') + (photo ? ' has-photo' : '') + '">' +
      '<div class="cp-tix__art">' + art + '</div>' +
      '<div class="cp-tix__body">' +
        '<div class="cp-tix__top"><h3>' + esc(c.title || c.code) + '</h3>' +
        '<span class="cp-tix__badge">' + esc(badge) + '</span></div>' +
        '<p class="cp-tix__meta">' + metaBits(c).map(esc).join('<br>') + '</p>' +
        '<p class="cp-tix__remain">' + esc(off && opts.reason ? opts.reason : remainText(c, kind)) + '</p>' +
        '<div class="cp-tix__foot">' +
          '<button type="button" class="cp-tix__more" data-cp="detail" data-cp-code="' + esc(c.code) + '">' + esc(t('coupon.more')) + '</button>' +
          right +
        '</div></div></article>';
  }
  function emptyHtml(title, desc) {
    var art = '<svg viewBox="0 0 120 100" width="120" height="100" aria-hidden="true"><g fill="none" stroke="#2b8cf0" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M16 52l44 14 44-14v30L60 96 16 82z" fill="#eaf4ff"/><path d="M16 52l-4-18 28 8M104 52l4-18-28 8M60 66v30"/><rect x="42" y="16" width="34" height="42" rx="3" transform="rotate(-6 59 37)" fill="#fff"/><path d="M52 38l14-14M52 26.5h.1M66 37.5h.1"/></g><path d="M20 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM100 14l1.4 3.4 3.4 1.4-3.4 1.4L100 24l-1.4-3.4-3.4-1.4 3.4-1.4z" fill="#8fc4f7"/></svg>';
    return '<section class="cp-empty">' + art + '<h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p></section>';
  }

  document.addEventListener('click', function (e) {
    var act = e.target.closest('[data-cp]');
    if (!act) return;
    var key = act.getAttribute('data-cp');
    if (key === 'copy') {
      var code = act.getAttribute('data-cp-code');
      if (code) copyCode(code);
    } else if (key === 'detail') {
      var row = find(act.getAttribute('data-cp-code'));
      if (row) showDetail(row);
    }
  });

  TTV.ui.couponTicket = {
    setCatalog: function (list) { catalog = list || []; },
    remember: function (list) { known = list || []; },
    card: cardHtml,
    empty: emptyHtml,
    meta: metaBits,
    facts: pickedFacts,
    remain: function (c) { return remainText(c, 'available'); },
    showDetail: showDetail,
    closeDetail: closeDetail,
    copy: copyCode
  };
})(window.TTV);
