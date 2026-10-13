/* Khung tối thiểu màn Đang nhận báo giá (4.9). Tự hủy khi hết quote_window_min. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var rootEl = null;
  var order = null;
  var tickTimer = null;
  var expiring = false;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key) { return TTV.I18n.t(key); }
  function money(n) { return TTV.Utils.money(n); }
  function quotesHeader() {
    return '<header class="app-header"><button type="button" class="app-header__back" data-route="/orders" aria-label="Quay lại">‹</button><h1>' + esc(t('quotes.title')) + '</h1></header>';
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
    stopTick();
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
        '<section class="order-card quotes-empty">' +
          '<span class="spinner"></span>' +
          '<h3>' + esc(t('quotes.empty.title')) + '</h3>' +
          '<p>' + esc(t('quotes.empty.desc')) + '</p>' +
        '</section>' +
      '</main>' +
      '<div class="quotes-bar">' +
        '<button type="button" class="quotes-cancel" data-action="cancel-finding">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/></svg>' +
          esc(t('quotes.cancel')) +
        '</button>' +
      '</div>';
    var bar = rootEl.querySelector('[data-action="cancel-finding"]');
    if (bar) bar.addEventListener('click', openCancelDlg);
    startTick();
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
    TTV.api.cancelFindingOrder(order.id).then(function () {
      TTV.Components.toast(t('quotes.cancel.done'), 'success');
      TTV.Router.navigate('/orders');
    }).catch(function (err) {
      startTick();
      TTV.Components.toast((err && err.message) || t('quotes.cancel.fail'), 'danger');
    });
  }

  TTV.screens.orderQuotes = {
    render: function (container, ctx) {
      this.destroy();
      rootEl = container;
      expiring = false;
      var id = ctx && ctx.params && ctx.params.id;
      rootEl.classList.add('is-order');
      rootEl.innerHTML = quotesHeader() +
        '<main class="page">' + TTV.Components.loading(t('common.loading')) + '</main>';
      var ready = TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve();
      ready.then(function () { return TTV.api.getOrder(id); }).then(function (row) {
        order = row;
        if (row.status === 'cancelled') {
          TTV.Components.toast(row.cancel_reason === 'Không tìm được thợ' ? t('quotes.expired') : t('quotes.cancelled'), 'info');
          TTV.Router.navigate('/orders', { replace: true });
          return;
        }
        paint();
      }).catch(function (err) {
        paintError((err && err.message) || t('quotes.err.title'));
      });
    },
    destroy: function () {
      stopTick();
      closeCancelDlg();
      if (rootEl) rootEl.classList.remove('is-order');
      rootEl = null;
      order = null;
      expiring = false;
    }
  };
})(window.TTV);
