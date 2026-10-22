/* Màn Đang nhận báo giá (khách) — 4.9 (khung) + 5.6 (danh sách báo giá).
   Báo giá của mọi thợ/tổ đội/công ty (đơn 1 thợ lẫn ≥ 2 thợ) xếp thấp → cao; khách tự chọn; tự cập nhật mỗi 4 giây.
   Tự hủy khi hết quote_window_min. Đơn đã ghép thì hiện thợ được chọn.
   Làm mới: Live ping khi thợ gửi báo giá; poll mốc đơn 4s khi đang ở màn này. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var order = null;
  var orderId = '';
  var tickTimer = null;
  var pollTimer = null;
  var unwatch = null;
  var polling = false;
  var pendingRefresh = false;
  var choosing = false;
  var pay = null;
  var quotes = [];
  var quotesSig = '';
  var quoteStamp = '';
  var POLL_MS = 4000;
  var expiring = false;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, params) { return TTV.I18n.t(key, params); }
  function money(n) { return TTV.Utils.money(n); }
  function quotesHeader(titleKey) {
    var oid = (order && order.id) || orderId || '';
    return '<header class="app-header"><button type="button" class="app-header__back" data-back data-after-place="' + esc(oid) + '" data-back-fallback="/orders" aria-label="Quay lại">‹</button><h1>' + esc(t(titleKey || 'quotes.title')) + '</h1></header>';
  }
  function pinSvg(kind) {
    var cls = kind === 'drop' ? 'quotes-pin quotes-pin--drop' : 'quotes-pin quotes-pin--pick';
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" d="M12 21.2s7-6.4 7-11.4A7 7 0 0 0 5 9.8c0 5 7 11.4 7 11.4z"/>' +
      '<circle cx="12" cy="9.6" r="2.55" fill="none" stroke="currentColor" stroke-width="2.1"/>' +
      '</svg>';
  }
  function clockSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8.2V12l2.6 2.2"/></svg>';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function formatRemain(ms) {
    if (ms == null) return '--:--';
    var s = Math.max(0, Math.ceil(ms / 1000));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }
  function deadlineMs() {
    if (!order) return 0;
    if (order.quote_deadline) {
      var d = Date.parse(order.quote_deadline);
      if (isFinite(d)) return d;
    }
    var start = Date.parse(order.created_at);
    var windowMs = TTV.pricing && TTV.pricing.quoteWindowMs ? TTV.pricing.quoteWindowMs() : 0;
    if (isFinite(start) && windowMs > 0) return start + windowMs;
    return 0;
  }
  function remainMs() {
    var end = deadlineMs();
    return end ? end - Date.now() : null;
  }
  function stopTick() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  function onExpired() {
    if (!order || expiring) return;
    expiring = true;
    stopTick();
    stopPoll();
    TTV.api.expireFindingIfNeeded(order.id).then(function (row) {
      TTV.Components.toast(t('quotes.expired'), 'info');
      TTV.Router.navigate('/orders', { replace: true });
      return row;
    }).catch(function (err) {
      expiring = false;
      TTV.Components.toast((err && err.message) || t('quotes.cancel.fail'), 'danger');
    });
  }
  function syncClock() {
    if (!rootEl) return;
    var left = remainMs();
    var el = rootEl.querySelector('[data-quote-clock]');
    if (el) el.textContent = formatRemain(left);
    if (left != null && left <= 0) onExpired();
  }
  function startTick() {
    stopTick();
    syncClock();
    tickTimer = setInterval(syncClock, 1000);
  }

  function paintError(msg) {
    if (!rootEl) return;
    stopTick(); stopPoll();
    rootEl.classList.add('is-order');
    rootEl.innerHTML = quotesHeader() +
      '<main class="page quotes-page">' + TTV.Components.emptyState(t('quotes.err.title'), msg) + '</main>';
  }

  function paint() {
    if (!rootEl || !order) return;
    var pick = (order.pickup && order.pickup.addr) || '—';
    var drop = (order.dropoff && order.dropoff.addr) || '—';
    var km = Number(order.distance_km);
    var kmText = isFinite(km) ? km.toFixed(2).replace('.', ',') + ' km' : '— km';
    var hasDrop = order.need_unload !== false;
    rootEl.classList.add('is-order');
    rootEl.innerHTML =
      quotesHeader() +
      '<main class="quotes-page">' +
        '<section class="order-card">' +
          '<p class="quotes-remain"><span>' + esc(t('quotes.remain')) + '</span>' +
            '<b class="quotes-remain__clock">' + clockSvg() + '<em data-quote-clock>' + esc(formatRemain(remainMs())) + '</em></b></p>' +
          '<p class="quotes-code">' + esc(TTV.Utils.orderCode(order.id)) + '</p>' +
          '<p class="quotes-stop">' + pinSvg('pick') + '<span><b>' + esc(t('quotes.pickup')) + '</b> ' + esc(pick) + '</span></p>' +
          (hasDrop
            ? '<p class="quotes-stop">' + pinSvg('drop') + '<span><b>' + esc(t('quotes.dropoff')) + '</b> ' + esc(drop) + '</span></p>' +
              '<p class="quotes-km">' + esc(kmText) + '</p>'
            : '') +
          '<p class="quotes-offer"><span>' + esc(t('quotes.offer')) + '</span><b>' + money(order.user_offer) + '</b></p>' +
        '</section>' +
        '<div data-quote-list>' + listMarkup() + '</div>' +
      '</main>' +
      '<div class="quotes-bar">' +
        '<button type="button" class="quotes-cancel" data-action="cancel-finding">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/></svg>' +
          esc(t('quotes.cancel')) +
        '</button>' +
      '</div>';
    var bar = rootEl.querySelector('[data-action="cancel-finding"]');
    if (bar) bar.addEventListener('click', openCancelDlg);
    bindList();
    startTick();
    startPoll();
  }

  /* ----- Danh sách báo giá (5.6) ----- */
  function typeText(v) {
    var base = t('quotes.type.' + v.type);
    return v.type === 'personal' ? base : base + ' · ' + t('quotes.team', { n: v.team_size });
  }
  function ratingText(v) { return v.rating > 0 ? v.rating.toFixed(1) + '/5' : t('quotes.noRating'); }
  function vendorMeta(q) {
    return esc(ratingText(q.vendor)) + ' · ' + esc(t('quotes.jobs', { n: q.vendor.jobs_done }));
  }
  function quoteCard(q, i, total) {
    var save = Number(order.user_offer) - q.price;
    return '<article class="qc-card' + (i === 0 && total > 1 ? ' is-best' : '') + '" data-quote="' + esc(q.id) + '">' +
      '<header class="qc-head">' + TTV.Components.avatar(q.vendor.name || '?', q.vendor.avatar_path, { size: 'md' }) +
        '<div class="qc-who"><b>' + esc(q.vendor.name || t('quotes.vendor.unknown')) + '</b>' +
          '<span>' + esc(typeText(q.vendor)) + '</span></div>' +
        '<div class="qc-price"><b>' + money(q.price) + '</b>' + (save > 0 ? '<small>' + esc(t('quotes.save', { n: money(save) })) + '</small>' : '') + '</div></header>' +
      '<p class="qc-meta">' + vendorMeta(q) + '</p>' +
      '<button type="button" class="qc-rev-link" data-reviews="' + esc(q.vendor.id) + '" data-reviews-name="' + esc(q.vendor.name || t('quotes.vendor.unknown')) + '">' + esc(t('quotes.reviews')) + '</button>' +
      '<p class="qc-meta qc-meta--eta">' + esc(t('quotes.eta', { n: q.eta_min })) + ' · ' + esc(TTV.Utils.relativeTime(q.updated_at || q.created_at)) + '</p>' +
      (q.message ? '<p class="qc-msg">“' + esc(q.message) + '”</p>' : '') +
      '<div class="qc-foot">' + (i === 0 && total > 1 ? '<span class="qc-tag">' + esc(t('quotes.best')) + '</span>' : '<span></span>') +
        '<button type="button" class="qc-pick" data-pick="' + esc(q.id) + '">' + esc(t('quotes.pick')) + '</button></div>' +
    '</article>';
  }
  function listMarkup() {
    if (!quotes.length) {
      return '<section class="order-card quotes-empty"><span class="spinner"></span><h3>' + esc(t('quotes.empty.title')) + '</h3><p>' + esc(t('quotes.empty.desc')) + '</p></section>';
    }
    return '<h2 class="qc-title">' + esc(t('quotes.list.title', { n: quotes.length })) + '</h2>' +
      quotes.map(function (q, i) { return quoteCard(q, i, quotes.length); }).join('');
  }
  function bindList() {
    if (!rootEl) return;
    rootEl.querySelectorAll('.qc-card .avatar img').forEach(function (img) { // ảnh đại diện lỗi → chữ cái đầu
      img.addEventListener('error', function () {
        var box = img.parentNode, name = (img.getAttribute('alt') || '?').trim();
        if (box) box.textContent = (name.charAt(0) || '?').toUpperCase();
      });
    });
  }
  function signature(list) { return list.map(function (q) { return [q.id, q.price, q.eta_min, q.message, q.updated_at].join('~'); }).join('|'); }
  function paintList() {
    var box = rootEl && rootEl.querySelector('[data-quote-list]');
    if (!box) return;
    box.innerHTML = listMarkup();
    bindList();
  }
  function findQuote(id) { for (var i = 0; i < quotes.length; i++) if (quotes[i].id === id) return quotes[i]; return null; }

  /* ----- Chốt thợ + mã giảm giá ----- */
  function closePickDlg() {
    document.querySelectorAll('[data-quotes-pick], .sheet-backdrop.is-quote-pay, .sheet-backdrop.is-order-coupons, .sheet-backdrop[data-cp-detail]').forEach(function (el) { el.remove(); });
    pay = null;
  }
  function couponOf(code) {
    var key = String(code || '').toUpperCase();
    return ((pay && pay.coupons) || []).filter(function (c) { return String(c.code) === key; })[0] || null;
  }
  function couponFit(c) {
    if (!c || !pay || !pay.q || !TTV.pricing || !TTV.pricing.applyCoupon) return { ok: false, reason: t('quotes.pay.bad') };
    return TTV.pricing.applyCoupon(pay.q.price, c, order && order.workers, null, order && order.service);
  }
  function payPreview() {
    if (!pay || !order) return Promise.resolve();
    return TTV.api.previewQuotePay(order.id, pay.q.id, pay.code).then(function (p) {
      if (!pay) return;
      pay.preview = p;
      if (p && p.ok === false && pay.code) {
        TTV.Components.toast(p.reason || t('quotes.pay.bad'), 'error');
        pay.code = '';
        return TTV.api.previewQuotePay(order.id, pay.q.id, '').then(function (plain) {
          if (pay) pay.preview = plain;
        });
      }
    }).catch(function (err) {
      TTV.Components.toast((err && err.message) || t('quotes.pay.bad'), 'error');
    }).then(function () { paintPaySheet(); });
  }
  function couponBlockHtml() {
    var Ticket = TTV.ui.couponTicket;
    var picked = pay.code ? (couponOf(pay.code) || (pay.preview && pay.preview.coupon) || { code: pay.code, title: pay.code }) : null;
    if (picked) {
      if (Ticket) { Ticket.remember(pay.coupons); }
      var facts = Ticket && couponOf(picked.code) ? Ticket.facts(picked) : [];
      return '<div class="order-coupon__picked">' +
        '<div class="order-coupon__head"><div class="order-coupon__info">' +
          '<p class="order-coupon__name">' + esc(picked.title || picked.code) + '</p>' +
          '<div class="order-coupon__codes"><span class="order-coupon__badge">' + esc(t('coupon.badge')) + '</span>' +
          '<span class="order-coupon__code">' + esc(picked.code) + '</span></div></div>' +
          '<button type="button" class="order-coupon__clear" data-qp="clear">' + esc(t('order.coupon.remove')) + '</button></div>' +
        (facts.length ? '<ul class="order-coupon__facts">' + facts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '</div>';
    }
    return '<div class="order-coupon__row">' +
        '<input type="text" data-qp-code maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="' + esc(t('coupon.placeholder')) + '">' +
        '<button type="button" class="btn btn-primary" data-qp="apply">' + esc(t('coupon.apply')) + '</button></div>' +
      '<button type="button" class="order-coupon__mine" data-qp="mine">' +
        '<span>' + esc(t('order.coupon.mine')) + (pay.coupons.length ? ' (' + pay.coupons.length + ')' : '') + '</span><span class="order-chevron">›</span></button>';
  }
  function payBodyHtml() {
    var q = pay.q, p = pay.preview || { price: q.price, discount: 0, final: q.price };
    var method = order && order.pay_method === 'wallet' ? t('od.pay.wallet') : t('od.pay.cash');
    var offLabel = p.discount && pay.code ? t('quotes.pay.offCode', { code: pay.code }) : t('od.pay.coupon');
    return '<p class="qp-lead">' + esc(t('quotes.pay.lead', { name: q.vendor.name, price: money(q.price) })) + '</p>' +
      '<h3 class="qp-h">' + esc(t('quotes.pay.coupon')) + '</h3>' +
      '<section class="order-card order-coupon">' + couponBlockHtml() + '</section>' +
      '<dl class="qp-sum">' +
        '<div><dt>' + esc(t('quotes.pay.base')) + '</dt><dd>' + money(p.price) + '</dd></div>' +
        '<div><dt>' + esc(offLabel) + '</dt><dd>' + (p.discount ? '−' + money(p.discount) : money(0)) + '</dd></div>' +
        '<div class="is-total"><dt>' + esc(t('quotes.pay.total')) + '</dt><dd>' + money(p.final) + '</dd></div>' +
        '<div><dt>' + esc(t('quotes.pay.method')) + '</dt><dd>' + esc(method) + '</dd></div>' +
      '</dl>' +
      '<p class="quotes-dlg__err" data-pick-err hidden></p>';
  }
  function bindPaySheet(box) {
    if (!box) return;
    var inp = box.querySelector('[data-qp-code]');
    if (inp) {
      inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase().replace(/\s+/g, ''); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); applyPayCoupon(inp.value, false); }
      });
    }
  }
  function paintPaySheet() {
    if (!pay || !pay.q) return;
    var p = pay.preview || { final: pay.q.price };
    var existing = document.querySelector('.sheet-backdrop.is-quote-pay');
    var body = payBodyHtml();
    var footer = '<div class="order-confirm-acts">' +
      '<button type="button" class="btn btn-secondary" data-qp="no">' + esc(t('quotes.pick.no')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-qp="yes">' + esc(t('quotes.pay.confirm', { price: money(p.final) })) + '</button></div>';
    if (existing) {
      var b = existing.querySelector('.bottom-sheet__body');
      var f = existing.querySelector('.bottom-sheet__footer');
      if (b) b.innerHTML = body;
      if (f) f.innerHTML = footer;
      bindPaySheet(existing);
      return;
    }
    document.body.insertAdjacentHTML('beforeend', TTV.Components.sheet(t('quotes.pay.title', { name: pay.q.vendor.name }), body, { footer: footer }));
    var bd = document.querySelector('.sheet-backdrop:last-of-type');
    if (bd) { bd.classList.add('is-quote-pay'); bd.setAttribute('data-quotes-pick', ''); bindPaySheet(bd); }
  }
  function applyPayCoupon(raw, fromPick) {
    if (!pay || pay.claiming) return;
    var code = String(raw || '').replace(/\s+/g, '').toUpperCase();
    if (!code) { TTV.Components.toast(t('order.coupon.empty'), 'error'); return; }
    function use(c) {
      if (c && !couponOf(c.code)) pay.coupons.push(c);
      pay.code = (c && c.code) || code;
      payPreview();
    }
    if (fromPick || couponOf(code)) {
      var owned = couponOf(code);
      var fit = couponFit(owned);
      if (!owned || !fit.ok) {
        TTV.Components.toast((fit && fit.reason) || t('quotes.pay.bad'), 'error');
        return;
      }
      use(owned);
      return;
    }
    pay.claiming = true;
    TTV.api.claimCoupon(code).then(function (c) { pay.claiming = false; use(c); }).catch(function (err) {
      pay.claiming = false;
      var msg = (err && err.code === 'COUPON_SOLD_OUT') ? t('coupon.soldOut') : ((err && err.message) || t('quotes.pay.bad'));
      TTV.Components.toast(msg, 'error');
    });
  }
  function openPayCouponList() {
    var Ticket = TTV.ui.couponTicket;
    if (Ticket) Ticket.remember(pay.coupons);
    var rows = pay.coupons.length && Ticket
      ? '<div class="cp-list">' + pay.coupons.map(function (c) {
          var fit = couponFit(c);
          return Ticket.card(c, 'available', { pick: true, picked: pay.code, disabled: !fit.ok, reason: fit.reason });
        }).join('') + '</div>'
      : (Ticket ? Ticket.empty(t('coupon.empty.available.title'), t('order.coupon.none')) : '');
    document.body.insertAdjacentHTML('beforeend', TTV.Components.sheet(t('order.coupon.pickTitle'), rows));
    var bd = document.querySelector('.sheet-backdrop:last-of-type');
    if (bd) bd.classList.add('is-order-coupons');
  }
  function openPickDlg(q) {
    closePickDlg();
    pay = { q: q, code: '', coupons: [], preview: { ok: true, price: q.price, discount: 0, final: q.price }, claiming: false };
    paintPaySheet();
    TTV.api.listMyCoupons().then(function (x) {
      if (!pay || pay.q !== q) return;
      pay.coupons = (x && x.available) || [];
      paintPaySheet();
    }).catch(function () {});
  }
  function confirmPick() {
    if (choosing || !order || !pay || !pay.q) return;
    var q = pay.q, code = pay.code || '';
    choosing = true;
    var yes = document.querySelector('.is-quote-pay [data-qp="yes"]');
    if (yes) yes.disabled = true;
    TTV.api.chooseQuote(order.id, q.id, code).then(function (res) {
      choosing = false; closePickDlg(); stopTick(); stopPoll();
      TTV.Components.toast(t('quotes.pick.done'), 'success');
      if (res && res.order) order = res.order;
      quotes = (res && res.quotes) || [q];
      paintMatched();
    }).catch(function (err) {
      choosing = false;
      if (yes) yes.disabled = false;
      var errCode = err && err.code;
      if (errCode === 'QUOTE_GONE' || errCode === 'QUOTE_NOT_FOUND' || errCode === 'CONFLICT') {
        closePickDlg(); TTV.Components.toast((err && err.message) || t('quotes.err.title'), 'error'); refresh(true);
        return;
      }
      var el = document.querySelector('.is-quote-pay [data-pick-err]');
      if (el) { el.textContent = (err && err.message) || t('quotes.err.title'); el.hidden = false; }
      else TTV.Components.toast((err && err.message) || t('quotes.err.title'), 'error');
    });
  }

  /* ----- Tự cập nhật: Live bus; nếu không có Live thì poll 4 giây ----- */
  function stopPoll() {
    if (unwatch) { unwatch(); unwatch = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function startPoll() {
    stopPoll();
    if (TTV.Live && TTV.Live.watch) {
      unwatch = TTV.Live.watch('orders', function () { refresh(false); }, { immediate: false });
      return;
    }
    pollTimer = setInterval(function () { refresh(false); }, POLL_MS);
  }
  // force = true: vẽ lại dù danh sách không đổi (sau khi chọn thợ)
  function refresh(force) {
    if (!rootEl || !order || choosing || expiring) return Promise.resolve();
    if (polling) { pendingRefresh = true; return Promise.resolve(); }
    var id = order.id;
    polling = true;
    return TTV.api.listOrderQuotes(id, { poll: !force, since: quoteStamp }).then(function (res) {
      polling = false;
      if (!rootEl || !order || order.id !== id) return;
      if (res && res.unchanged) {
        if (pendingRefresh) { pendingRefresh = false; return refresh(false); }
        return;
      }
      if (res && res.stamp) quoteStamp = res.stamp;
      order = res.order;
      if (order.status === 'cancelled') {
        stopPoll(); stopTick();
        TTV.Components.toast(order.cancel_reason === 'Không tìm được thợ' ? t('quotes.expired') : t('quotes.cancelled'), 'info');
        TTV.Router.navigate('/orders', { replace: true });
        return;
      }
      if (order.status !== 'finding') { stopPoll(); stopTick(); quotes = res.quotes; paintMatched(); return; }
      var sig = signature(res.quotes);
      if (force || sig !== quotesSig) { quotes = res.quotes; quotesSig = sig; paintList(); }
      if (pendingRefresh) { pendingRefresh = false; return refresh(false); }
    }).catch(function () {
      polling = false;
      if (pendingRefresh) { pendingRefresh = false; return refresh(false); }
    });
  }

  function matchedPayHtml(q) {
    var pb = order.price_breakdown || {};
    var quoted = Math.round(Number(q && q.price) || 0);
    if (!quoted) quoted = Math.round(Number(order.final_price) || 0) + Math.round(Number(pb.discount) || 0);
    var disc = Math.round(Number(pb.discount) || 0);
    var total = order.final_price != null ? order.final_price : (quoted - disc);
    var method = order.pay_method === 'wallet' ? t('od.pay.wallet') : t('od.pay.cash');
    var offLabel = order.coupon_id ? t('od.pay.off', { code: order.coupon_id }) : t('od.pay.coupon');
    return '<section class="order-card od-pay">' +
      '<h2 class="od-h od-h--in">' + esc(t('od.pay')) + '</h2>' +
      (quoted > 0 ? '<div class="od-row od-row--soft"><span>' + esc(t('od.pay.quote')) + '</span><b>' + money(quoted) + '</b></div>' : '') +
      (disc > 0 ? '<div class="od-row od-row--soft"><span>' + esc(offLabel) + '</span><b>−' + money(disc) + '</b></div>' : '') +
      '<div class="od-row od-row--total"><span>' + esc(t('od.pay.total')) + '</span><b>' + money(total) + '</b></div>' +
      '<div class="od-row od-row--soft"><span>' + esc(t('od.pay.method')) + '</span><b>' + esc(method) + '</b></div>' +
      '</section>';
  }
  /* ----- Đơn đã ghép thợ ----- */
  function successCheck() {
    return '<span class="qc-success__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#fff"/><path d="M7.5 12.4 10.4 15.2 16.5 8.8" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }
  function paintMatched() {
    if (!rootEl || !order) return;
    var q = quotes[0], v = q && q.vendor;
    var name = (v && v.name) || '';
    var tel = v ? String(v.phone || '').replace(/[^\d+]/g, '') : '';
    var desc = name ? t('quotes.matched.desc', { name: name }) : t('quotes.matched.desc.anon');
    rootEl.classList.add('is-order');
    rootEl.innerHTML = quotesHeader('quotes.matched.header') +
      '<main class="quotes-page quotes-page--matched">' +
        '<section class="qc-success" role="status">' + successCheck() +
          '<h3>' + esc(t('quotes.matched.title')) + '</h3>' +
          '<p>' + esc(desc) + '</p>' +
          '<p class="qc-success__code">' + esc(TTV.Utils.orderCode(order.id)) + '</p></section>' +
        (q ? '<section class="order-card qc-picked">' +
          '<p class="qc-picked__label">' + esc(t('quotes.matched.picked')) + '</p>' +
          '<article class="qc-card qc-card--plain"><header class="qc-head">' + TTV.Components.avatar(v.name || '?', v.avatar_path, { size: 'md' }) +
            '<div class="qc-who"><b>' + esc(v.name || t('quotes.vendor.unknown')) + '</b><span>' + esc(typeText(v)) + '</span></div>' +
            '<div class="qc-price"><b>' + money(q.price) + '</b><small>' + esc(t('quotes.pay.base')) + '</small></div></header>' +
          '<p class="qc-meta">' + vendorMeta(q) + '</p>' +
          '<p class="qc-meta qc-meta--eta">' + esc(t('quotes.eta', { n: q.eta_min })) + '</p>' +
          (q.message ? '<p class="qc-msg">“' + esc(q.message) + '”</p>' : '') +
          (tel ? '<a class="btn btn-primary btn-block qc-call" href="tel:' + esc(tel) + '">' + esc(t('quotes.call', { phone: v.phone })) + '</a>' : '') +
          '</article></section>' + matchedPayHtml(q) : '') +
      '</main>' +
      '<div class="quotes-bar"><button type="button" class="btn btn-secondary btn-block" data-route="/orders">' + esc(t('quotes.matched.cta')) + '</button></div>';
    bindList();
  }

  function closeCancelDlg() {
    var dlg = document.querySelector('[data-quotes-dlg]');
    if (dlg) dlg.remove();
  }
  function openCancelDlg() {
    if (!order) return;
    closeCancelDlg();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="quotes-dlg" data-quotes-dlg>' +
        '<div class="quotes-dlg__card" role="dialog" aria-modal="true" aria-labelledby="quotes-dlg-title">' +
          '<h3 id="quotes-dlg-title">' + esc(t('quotes.cancel.title')) + '</h3>' +
          '<p>' + esc(t('quotes.cancel.body')) + '</p>' +
          '<div class="quotes-dlg__acts">' +
            '<button type="button" class="quotes-dlg__no" data-quotes-dlg-no>' + esc(t('quotes.cancel.no')) + '</button>' +
            '<button type="button" class="quotes-dlg__yes" data-quotes-dlg-yes>' + esc(t('quotes.cancel.yes')) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>');
    var dlg = document.querySelector('[data-quotes-dlg]');
    if (!dlg) return;
    dlg.querySelector('[data-quotes-dlg-no]').addEventListener('click', closeCancelDlg);
    dlg.querySelector('[data-quotes-dlg-yes]').addEventListener('click', confirmCancel);
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) closeCancelDlg();
    });
  }
  function confirmCancel() {
    if (!order) return;
    closeCancelDlg();
    stopTick();
    stopPoll();
    TTV.api.cancelFindingOrder(order.id).then(function () {
      TTV.Components.toast(t('quotes.cancel.done'), 'success');
      TTV.Router.navigate('/orders');
    }).catch(function (err) {
      startTick(); startPoll();
      TTV.Components.toast((err && err.message) || t('quotes.cancel.fail'), 'danger');
    });
  }

  var REV_PAGE = 10;
  function closeReviews() {
    var d = document.querySelector('[data-qc-rev]');
    if (d) d.remove();
  }
  function starRow(n) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      var on = i <= n;
      out += '<svg class="qc-rev__star' + (on ? ' is-on' : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path fill="' + (on ? '#F5B400' : 'none') + '" stroke="' + (on ? '#F5B400' : '#D8DEE8') + '" stroke-width="1.4" stroke-linejoin="round" d="m12 3.4 2.6 5.4 6 .8-4.4 4.2 1.1 5.9L12 16.8 6.7 19.7 7.8 13.8 3.4 9.6l6-.8z"/></svg>';
    }
    return '<span class="qc-rev__stars">' + out + '</span>';
  }
  function reviewItemsHtml(list) {
    return (list || []).map(function (it) {
      var r = it.review || {};
      return '<article class="qc-rev__item">' +
        '<header><b>' + esc(it.customer_name || t('quotes.reviews.guest')) + '</b>' +
          (r.created_at ? '<small>' + esc(TTV.Utils.relativeTime(r.created_at)) + '</small>' : '') + '</header>' +
        starRow(Number(r.rating) || 0) +
        (r.comment ? '<p>“' + esc(r.comment) + '”</p>' : '') +
        (r.vendor_reply ? '<p class="qc-rev__reply">' + esc(t('quotes.reviews.reply', { text: r.vendor_reply })) + '</p>' : '') +
      '</article>';
    }).join('');
  }
  function fmtRating(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }
  function paintReviewMore(dlg, state) {
    var more = dlg.querySelector('[data-qc-rev-more]');
    if (!more) return;
    var left = state.total - state.shown;
    more.hidden = left <= 0;
    more.textContent = t('quotes.reviews.more', { n: left });
  }
  function openReviews(vid, name) {
    closeReviews();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="quotes-dlg qc-rev" data-qc-rev>' +
        '<div class="qc-rev__card" role="dialog" aria-modal="true">' +
          '<header class="qc-rev__head"><div><h3>' + esc(t('quotes.reviews.title', { name: name })) + '</h3>' +
            '<p class="qc-rev__sum" data-qc-rev-sum></p></div>' +
            '<button type="button" class="qc-rev__x" data-qc-rev-x aria-label="' + esc(t('quotes.reviews.close')) + '">×</button></header>' +
          '<div class="qc-rev__list" data-qc-rev-list>' + TTV.Components.loading(t('common.loading')) + '</div>' +
          '<div class="qc-rev__morewrap"><button type="button" class="qc-rev__more" data-qc-rev-more hidden></button></div>' +
        '</div></div>');
    var dlg = document.querySelector('[data-qc-rev]');
    var state = { vid: vid, shown: 0, total: 0, loading: false };
    function close() { closeReviews(); }
    dlg.querySelector('[data-qc-rev-x]').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    function loadPage() {
      if (state.loading) return;
      state.loading = true;
      var more = dlg.querySelector('[data-qc-rev-more]');
      if (more && state.shown) { more.disabled = true; }
      TTV.api.listPublicVendorReviews(vid, { offset: state.shown, limit: REV_PAGE }).then(function (res) {
        if (!document.body.contains(dlg)) return;
        state.loading = false;
        state.total = Number(res.total) || 0;
        var page = res.reviews || [];
        var box = dlg.querySelector('[data-qc-rev-list]');
        var sum = dlg.querySelector('[data-qc-rev-sum]');
        if (sum) {
          sum.textContent = state.total
            ? t('quotes.reviews.summary', { rating: fmtRating(res.rating), n: state.total })
            : t('quotes.reviews.empty');
        }
        if (!box) return;
        if (!state.shown && !page.length) {
          box.innerHTML = '<div class="qc-rev__empty"><h4>' + esc(t('quotes.reviews.empty')) + '</h4><p>' + esc(t('quotes.reviews.empty.desc')) + '</p></div>';
        } else if (!state.shown) {
          box.innerHTML = reviewItemsHtml(page);
        } else {
          box.insertAdjacentHTML('beforeend', reviewItemsHtml(page));
        }
        state.shown += page.length;
        paintReviewMore(dlg, state);
        if (more) more.disabled = false;
      }).catch(function (err) {
        state.loading = false;
        if (!document.body.contains(dlg)) return;
        var box = dlg.querySelector('[data-qc-rev-list]');
        if (box && !state.shown) box.innerHTML = '<p class="qc-rev__err">' + esc((err && err.message) || t('quotes.err.title')) + '</p>';
        if (more) more.disabled = false;
      });
    }
    dlg.querySelector('[data-qc-rev-more]').addEventListener('click', loadPage);
    loadPage();
  }
  function onDocClick(e) {
    var paySheet = e.target.closest('.is-quote-pay');
    if (paySheet && (e.target === paySheet || e.target.closest('button[data-sheet-close]'))) {
      closePickDlg();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!pay) return;
    var cp = e.target.closest('[data-pick-coupon]');
    if (cp) {
      applyPayCoupon(cp.getAttribute('data-pick-coupon'), true);
      document.querySelectorAll('.sheet-backdrop.is-order-coupons, .sheet-backdrop[data-cp-detail]').forEach(function (el) { el.remove(); });
      return;
    }
    var act = e.target.closest('[data-qp]');
    if (!act) return;
    var k = act.getAttribute('data-qp');
    if (k === 'apply') applyPayCoupon((document.querySelector('[data-qp-code]') || {}).value, false);
    else if (k === 'clear') { pay.code = ''; payPreview(); }
    else if (k === 'mine') openPayCouponList();
    else if (k === 'no') closePickDlg();
    else if (k === 'yes') confirmPick();
  }
  function onPickClick(e) {
    var rev = e.target.closest('[data-reviews]');
    if (rev) {
      e.preventDefault();
      openReviews(rev.getAttribute('data-reviews'), rev.getAttribute('data-reviews-name') || t('quotes.vendor.unknown'));
      return;
    }
    var b = e.target.closest('[data-pick]'); if (!b || !order || order.status !== 'finding') return;
    var q = findQuote(b.getAttribute('data-pick'));
    if (q) openPickDlg(q);
  }

  TTV.screens.orderQuotes = {
    render: function (container, ctx) {
      this.destroy();
      rootEl = container;
      expiring = false; choosing = false; polling = false; pendingRefresh = false; quotes = []; quotesSig = ''; quoteStamp = '';
      rootEl.addEventListener('click', onPickClick);
      document.addEventListener('click', onDocClick, true);
      var id = ctx && ctx.params && ctx.params.id;
      orderId = id || '';
      rootEl.classList.add('is-order');
      rootEl.innerHTML = quotesHeader() +
        '<main class="page">' + TTV.Components.loading(t('common.loading')) + '</main>';
      var ready = TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve();
      ready.then(function () { return TTV.api.listOrderQuotes(id); }).then(function (res) {
        var row = res.order;
        if (res && res.stamp) quoteStamp = res.stamp;
        order = row; quotes = res.quotes; quotesSig = signature(quotes);
        if (row.status === 'cancelled') {
          TTV.Components.toast(row.cancel_reason === 'Không tìm được thợ' ? t('quotes.expired') : t('quotes.cancelled'), 'info');
          TTV.Router.navigate('/orders', { replace: true });
          return;
        }
        if (row.status !== 'finding') { paintMatched(); return; }
        paint();
      }).catch(function (err) {
        paintError((err && err.message) || t('quotes.err.title'));
      });
    },
    destroy: function () {
      stopTick(); stopPoll();
      closeCancelDlg(); closePickDlg(); closeReviews();
      if (rootEl) { rootEl.classList.remove('is-order'); rootEl.removeEventListener('click', onPickClick); }
      document.removeEventListener('click', onDocClick, true);
      rootEl = null;
      order = null;
      orderId = '';
      quotes = []; quotesSig = ''; quoteStamp = '';
      expiring = false; choosing = false; polling = false; pendingRefresh = false;
    }
  };
})(window.TTV);
