/* Ví khách — #/wallet + #/wallet/history (task 7.1, ảnh 11 & 13). Nền thẻ: uploads/img-giaodien/vivuatoi.png */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var CARD_BG = 'uploads/img-giaodien/vivuatoi.png';
  var HIDE_KEY = 'ttv_wallet_hide';
  var rootEl = null;
  var mode = 'home';
  var tab = 'all';
  var hidden = false;
  var balance = 0;
  var txs = [];

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function vnd(n) { return TTV.Utils.money(n, { currency: false }) + 'đ'; }

  function readHidden() {
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch (_) { return false; }
  }
  function writeHidden(v) {
    try { sessionStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch (_) {}
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dmy(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function dayKey(iso) {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return '0';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dayLabel(key) {
    var now = new Date();
    var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yk = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
    if (key === today) return t('wallet.today');
    if (key === yk) return t('wallet.yesterday');
    var p = String(key).split('-');
    return t('wallet.day', { d: Number(p[2]), m: Number(p[1]), y: p[0] });
  }
  function grouped(list) {
    var map = {}, keys = [];
    list.forEach(function (row) {
      var k = dayKey(row.created_at);
      if (!map[k]) { map[k] = []; keys.push(k); }
      map[k].push(row);
    });
    keys.sort(function (a, b) { return a < b ? 1 : a > b ? -1 : 0; });
    return keys.map(function (k) { return { key: k, items: map[k] }; });
  }
  function titleOf(row) {
    if (row.type === 'topup' && row.status === 'pending') return t('wallet.tx.topupPending');
    if (row.type === 'topup' && row.status === 'failed') return t('wallet.tx.topupFail');
    if (row.type === 'topup') return t('wallet.tx.topup');
    if (row.type === 'refund') return t('wallet.tx.refund');
    if (row.type === 'hold') return t('wallet.tx.hold');
    return t('wallet.tx.payment');
  }
  function statusOf(row) {
    if (row.status === 'pending') return t('wallet.st.pending');
    if (row.status === 'failed') return t('wallet.st.failed');
    return '';
  }
  function clockIco() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4.2 7.2A8.2 8.2 0 1 1 3.8 12"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3.6 3.8v4h4"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8.6v4.2l2.6 1.6"/></svg>';
  }
  function txClockIco() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 8.4v4l2.6 1.6"/></svg>';
  }
  function eyeIco(open) {
    if (open) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3.5 12s3.4-6.2 8.5-6.2S20.5 12 20.5 12 17.1 18.2 12 18.2 3.5 12 3.5 12z"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3.5 12s3.4-6.2 8.5-6.2S20.5 12 20.5 12 17.1 18.2 12 18.2 3.5 12 3.5 12z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19 19 5"/></svg>';
  }
  function txRow(row, withDate) {
    var pending = row.status === 'pending';
    var failed = row.status === 'failed';
    var st = statusOf(row);
    var when = withDate ? (hm(row.created_at) + ' · ' + dmy(row.created_at)) : hm(row.created_at);
    var amtCls = pending || failed ? ' is-pending' : (row.type === 'topup' || row.type === 'refund' ? ' is-in' : ' is-out');
    return '<article class="wal-tx">' +
      '<span class="wal-tx__ico" aria-hidden="true">' + txClockIco() + '</span>' +
      '<div class="wal-tx__body"><b>' + esc(titleOf(row)) + '</b><small>' + esc(when) + '</small></div>' +
      '<div class="wal-tx__amt' + amtCls + '"><b>' + esc(vnd(row.amount)) + '</b>' +
        (st ? '<small>' + esc(st) + '</small>' : '') + '</div></article>';
  }

  function goDeposit() {
    if (TTV.Router.has('/wallet/deposit')) TTV.Router.navigate('/wallet/deposit');
    else TTV.Components.toast(t('wallet.depositSoon'), 'info');
  }

  function cardHtml() {
    var shown = hidden ? '••••••' : vnd(balance);
    return '<section class="wal-card" style="background-image:url(\'' + CARD_BG + '\')">' +
      '<div class="wal-card__top"><span>' + esc(t('wallet.available')) + '</span>' +
        '<button type="button" class="wal-eye" data-wal-eye aria-label="' + esc(hidden ? t('wallet.show') : t('wallet.hide')) + '">' +
          eyeIco(!hidden) + '</button></div>' +
      '<p class="wal-card__bal">' + esc(shown) + '</p>' +
      '<p class="wal-card__sub">' + esc(t('wallet.main')) + '</p>' +
      '<button type="button" class="wal-topup" data-wal-topup>+ ' + esc(t('wallet.topup')) + '</button>' +
    '</section>';
  }

  function homeHtml() {
    var recent = txs.slice(0, 5);
    return '<div class="wal">' +
      '<header class="wal-hero">' +
        '<h1>' + esc(t('wallet.title')) + '</h1>' +
        '<button type="button" class="wal-clock" data-route="/wallet/history" aria-label="' + esc(t('wallet.history')) + '">' + clockIco() + '</button>' +
      '</header>' +
      '<main class="wal-page">' +
        cardHtml() +
        '<aside class="wal-hint"><span>ⓘ</span><p>' + esc(t('wallet.hint')) + '</p></aside>' +
        '<div class="wal-recent-head"><h2>' + esc(t('wallet.recent')) + '</h2></div>' +
        (recent.length
          ? '<section class="wal-list">' + recent.map(function (row) { return txRow(row, true); }).join('') + '</section>' +
            '<button type="button" class="wal-all" data-route="/wallet/history">' + esc(t('wallet.seeAll')) + ' ›</button>'
          : '<p class="wal-none">' + esc(t('wallet.empty.short')) + '</p>') +
      '</main>' +
      TTV.Components.bottomTab('wallet') +
    '</div>';
  }

  function historyHtml() {
    var tabs = [
      { id: 'all', label: t('wallet.tab.all') },
      { id: 'topup', label: t('wallet.tab.topup') },
      { id: 'payment', label: t('wallet.tab.payment') },
      { id: 'refund', label: t('wallet.tab.refund') }
    ];
    var groups = grouped(txs);
    var list = groups.length
      ? groups.map(function (g) {
          return '<h3 class="wal-day">' + esc(dayLabel(g.key)) + '</h3>' +
            '<section class="wal-list">' + g.items.map(function (row) { return txRow(row, false); }).join('') + '</section>';
        }).join('')
      : '<section class="empty-state wal-empty"><div class="empty-state__icon">₫</div><h3>' + esc(t('wallet.empty.title')) + '</h3><p>' + esc(t('wallet.empty.desc')) + '</p></section>';
    return '<div class="wal wal--hist">' +
      '<header class="app-header wal-hist-head">' +
        '<button type="button" class="app-header__back" data-back data-back-fallback="/wallet" aria-label="Quay lại">‹</button>' +
        '<h1>' + esc(t('wallet.history')) + '</h1></header>' +
      '<main class="wal-hist">' +
        '<div class="wal-tabs" role="tablist">' + tabs.map(function (it) {
          return '<button type="button" role="tab" class="wal-tab' + (it.id === tab ? ' is-on' : '') + '" data-wal-tab="' + it.id + '" aria-selected="' + (it.id === tab) + '">' + esc(it.label) + '</button>';
        }).join('') + '</div>' + list +
      '</main></div>';
  }

  function bind() {
    if (!rootEl) return;
    rootEl.removeEventListener('click', onClick);
    rootEl.addEventListener('click', onClick);
  }
  function onClick(e) {
    var eye = e.target.closest('[data-wal-eye]');
    if (eye) {
      hidden = !hidden;
      writeHidden(hidden);
      var card = rootEl.querySelector('.wal-card');
      if (card) {
        var bal = card.querySelector('.wal-card__bal');
        if (bal) bal.textContent = hidden ? '••••••' : vnd(balance);
        eye.setAttribute('aria-label', hidden ? t('wallet.show') : t('wallet.hide'));
        eye.innerHTML = eyeIco(!hidden);
      }
      return;
    }
    if (e.target.closest('[data-wal-topup]')) { goDeposit(); return; }
    var chip = e.target.closest('[data-wal-tab]');
    if (chip) {
      tab = chip.getAttribute('data-wal-tab') || 'all';
      load();
    }
  }

  function paint() {
    if (!rootEl) return;
    rootEl.innerHTML = mode === 'history' ? historyHtml() : homeHtml();
    bind();
  }
  function paintErr(msg) {
    if (!rootEl) return;
    rootEl.innerHTML = TTV.Components.header(t('wallet.title'), { back: mode === 'history' }) +
      '<main class="page">' + TTV.Components.emptyState(t('wallet.err'), msg || '') + '</main>' +
      (mode === 'history' ? '' : TTV.Components.bottomTab('wallet'));
  }
  function load() {
    var p = mode === 'history'
      ? Promise.all([TTV.api.getWallet(), TTV.api.listWalletTransactions({ tab: tab })])
      : Promise.all([TTV.api.getWallet(), TTV.api.listWalletTransactions({ limit: 8 })]);
    return p.then(function (parts) {
      balance = parts[0].balance;
      txs = parts[1] || [];
      paint();
    }).catch(function (err) {
      paintErr(err && err.message);
    });
  }

  function open(container, nextMode) {
    TTV.screens.wallet.destroy();
    rootEl = container;
    mode = nextMode || 'home';
    tab = 'all';
    hidden = readHidden();
    container.classList.remove('is-wide');
    container.innerHTML = TTV.Components.loading(t('common.loading'));
    load();
  }

  TTV.screens.wallet = {
    render: function (container) { open(container, 'home'); },
    renderHistory: function (container) { open(container, 'history'); },
    destroy: function () {
      if (rootEl) rootEl.removeEventListener('click', onClick);
      rootEl = null;
    }
  };
})(window.TTV);
