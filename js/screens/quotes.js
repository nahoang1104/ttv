/* Màn Đang nhận báo giá (khách) — 4.9 (khung) + 5.6 (danh sách báo giá).
   Báo giá của mọi thợ/tổ đội/công ty (đơn 1 thợ lẫn ≥ 2 thợ) xếp thấp → cao; khách tự chọn; tự cập nhật mỗi 4 giây.
   Tự hủy khi hết quote_window_min. Đơn đã ghép thì hiện thợ được chọn. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var order = null;
  var orderId = '';
  var tickTimer = null;
  var pollTimer = null;
  var polling = false;
  var choosing = false;
  var quotes = [];
  var quotesSig = '';
  var POLL_MS = 4000;
  var expiring = false;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, params) { return TTV.I18n.t(key, params); }
  function money(n) { return TTV.Utils.money(n); }
  function quotesHeader() {
    var oid = (order && order.id) || orderId || '';
    return '<header class="app-header"><button type="button" class="app-header__back" data-back data-after-place="' + esc(oid) + '" data-back-fallback="/orders" aria-label="Quay lại">‹</button><h1>' + esc(t('quotes.title')) + '</h1></header>';
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
    rootEl.classList.add('is-order');
    rootEl.innerHTML =
      quotesHeader() +
      '<main class="quotes-page">' +
        '<section class="order-card">' +
          '<p class="quotes-remain"><span>' + esc(t('quotes.remain')) + '</span>' +
            '<b class="quotes-remain__clock">' + clockSvg() + '<em data-quote-clock>' + esc(formatRemain(remainMs())) + '</em></b></p>' +
          '<p class="quotes-code">' + esc(TTV.Utils.orderCode(order.id)) + '</p>' +
          '<p class="quotes-stop">' + pinSvg('pick') + '<span><b>' + esc(t('quotes.pickup')) + '</b> ' + esc(pick) + '</span></p>' +
          '<p class="quotes-stop">' + pinSvg('drop') + '<span><b>' + esc(t('quotes.dropoff')) + '</b> ' + esc(drop) + '</span></p>' +
          '<p class="quotes-km">' + esc(kmText) + '</p>' +
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
  function ratingText(v) { return v.rating > 0 ? '★ ' + v.rating.toFixed(1).replace('.', ',') : t('quotes.noRating'); }
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

  /* ----- Chọn thợ ----- */
  function closePickDlg() { var d = document.querySelector('[data-quotes-pick]'); if (d) d.remove(); }
  function openPickDlg(q) {
    closePickDlg();
    document.body.insertAdjacentHTML('beforeend',
      '<div class="quotes-dlg" data-quotes-pick>' +
        '<div class="quotes-dlg__card" role="dialog" aria-modal="true">' +
          '<h3>' + esc(t('quotes.pick.title', { name: q.vendor.name })) + '</h3>' +
          '<p>' + esc(t('quotes.pick.body', { price: money(q.price) })) + '</p>' +
          '<p class="quotes-dlg__err" data-pick-err hidden></p>' +
          '<div class="quotes-dlg__acts">' +
            '<button type="button" class="quotes-dlg__no" data-pick-no>' + esc(t('quotes.pick.no')) + '</button>' +
            '<button type="button" class="quotes-dlg__yes quotes-dlg__yes--ok" data-pick-yes>' + esc(t('quotes.pick.yes')) + '</button>' +
          '</div></div></div>');
    var dlg = document.querySelector('[data-quotes-pick]');
    dlg.querySelector('[data-pick-no]').addEventListener('click', closePickDlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closePickDlg(); });
    dlg.querySelector('[data-pick-yes]').addEventListener('click', function () { confirmPick(q, dlg); });
  }
  function confirmPick(q, dlg) {
    if (choosing || !order) return;
    choosing = true;
    var yes = dlg.querySelector('[data-pick-yes]'); yes.disabled = true;
    TTV.api.chooseQuote(order.id, q.id).then(function () {
      choosing = false; closePickDlg(); stopTick();
      TTV.Components.toast(t('quotes.pick.done'), 'success');
      return refresh(true);
    }).catch(function (err) {
      choosing = false; yes.disabled = false;
      var code = err && err.code;
      if (code === 'QUOTE_GONE' || code === 'QUOTE_NOT_FOUND' || code === 'CONFLICT') { // báo giá đổi / đơn đã đổi: đóng hộp, tải lại danh sách
        closePickDlg(); TTV.Components.toast((err && err.message) || t('quotes.err.title'), 'danger'); refresh(true);
        return;
      }
      var el = dlg.querySelector('[data-pick-err]');
      if (el) { el.textContent = (err && err.message) || t('quotes.err.title'); el.hidden = false; }
    });
  }

  /* ----- Tự cập nhật (4 giây) ----- */
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function startPoll() { stopPoll(); pollTimer = setInterval(function () { refresh(false); }, POLL_MS); }
  // force = true: vẽ lại dù danh sách không đổi (sau khi chọn thợ)
  function refresh(force) {
    if (!rootEl || !order || polling || choosing || expiring) return Promise.resolve();
    var id = order.id;
    polling = true;
    return TTV.api.listOrderQuotes(id).then(function (res) {
      polling = false;
      if (!rootEl || !order || order.id !== id) return;
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
    }).catch(function () { polling = false; }); // lỗi tạm thời: bỏ qua, lần sau thử lại
  }

  /* ----- Đơn đã ghép thợ ----- */
  function paintMatched() {
    if (!rootEl || !order) return;
    var q = quotes[0], v = q && q.vendor;
    var tel = v ? String(v.phone || '').replace(/[^\d+]/g, '') : '';
    rootEl.classList.add('is-order');
    rootEl.innerHTML = quotesHeader() +
      '<main class="quotes-page">' +
        '<section class="order-card qc-matched"><span class="qc-matched__icon" aria-hidden="true">✓</span>' +
          '<h3>' + esc(t('quotes.matched.title')) + '</h3><p>' + esc(t('quotes.matched.desc')) + '</p>' +
          '<p class="quotes-code">' + esc(TTV.Utils.orderCode(order.id)) + '</p></section>' +
        (q ? '<section class="order-card">' +
          '<article class="qc-card qc-card--plain"><header class="qc-head">' + TTV.Components.avatar(v.name || '?', v.avatar_path, { size: 'md' }) +
            '<div class="qc-who"><b>' + esc(v.name || t('quotes.vendor.unknown')) + '</b><span>' + esc(typeText(v)) + '</span></div>' +
            '<div class="qc-price"><b>' + money(order.final_price != null ? order.final_price : q.price) + '</b><small>' + esc(t('quotes.total')) + '</small></div></header>' +
          '<p class="qc-meta">' + vendorMeta(q) + '</p>' +
          '<p class="qc-meta qc-meta--eta">' + esc(t('quotes.eta', { n: q.eta_min })) + '</p>' +
          (q.message ? '<p class="qc-msg">“' + esc(q.message) + '”</p>' : '') +
          (tel ? '<a class="btn btn-secondary btn-block qc-call" href="tel:' + esc(tel) + '">' + esc(t('quotes.call', { phone: v.phone })) + '</a>' : '') +
          '</article></section>' : '') +
      '</main>' +
      '<div class="quotes-bar"><button type="button" class="btn btn-primary btn-block" data-route="/orders">' + esc(t('quotes.matched.cta')) + '</button></div>';
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

  function onPickClick(e) {
    var b = e.target.closest('[data-pick]'); if (!b || !order || order.status !== 'finding') return;
    var q = findQuote(b.getAttribute('data-pick'));
    if (q) openPickDlg(q);
  }

  TTV.screens.orderQuotes = {
    render: function (container, ctx) {
      this.destroy();
      rootEl = container;
      expiring = false; choosing = false; polling = false; quotes = []; quotesSig = '';
      rootEl.addEventListener('click', onPickClick);
      var id = ctx && ctx.params && ctx.params.id;
      orderId = id || '';
      rootEl.classList.add('is-order');
      rootEl.innerHTML = quotesHeader() +
        '<main class="page">' + TTV.Components.loading(t('common.loading')) + '</main>';
      var ready = TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve();
      ready.then(function () { return TTV.api.listOrderQuotes(id); }).then(function (res) {
        var row = res.order;
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
      closeCancelDlg(); closePickDlg();
      if (rootEl) { rootEl.classList.remove('is-order'); rootEl.removeEventListener('click', onPickClick); }
      rootEl = null;
      order = null;
      orderId = '';
      quotes = [];
      expiring = false; choosing = false; polling = false;
    }
  };
})(window.TTV);
