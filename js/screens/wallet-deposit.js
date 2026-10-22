/* Nạp tiền vào ví — #/wallet/deposit (task 7.2, ảnh 12). Chỉ giao diện; chưa gọi cổng giả. Không có MoMo. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var CARD_BG = 'uploads/img-giaodien/vivuatoi.png';
  var HIDE_KEY = 'ttv_wallet_hide';
  var FALLBACK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];
  var MIN = 10000, MAX = 50000000;
  var rootEl = null;
  var state = null;
  var busy = false;

  function esc(v) { return TTV.Components.escape(v); }
  function t(key, vars) { return TTV.I18n.t(key, vars); }
  function vnd(n) { return TTV.Utils.money(n, { currency: false }) + 'đ'; }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function fmtNum(n) { return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; }
  function readHidden() {
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch (_) { return false; }
  }
  function writeHidden(v) {
    try { sessionStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch (_) {}
  }
  function eyeIco(open) {
    if (open) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3.5 12s3.4-6.2 8.5-6.2S20.5 12 20.5 12 17.1 18.2 12 18.2 3.5 12 3.5 12z"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3.5 12s3.4-6.2 8.5-6.2S20.5 12 20.5 12 17.1 18.2 12 18.2 3.5 12 3.5 12z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M5 19 19 5"/></svg>';
  }
  function vnpayLogo() {
    return '<span class="wd-vnpay" aria-hidden="true"><img src="uploads/img-giaodien/ic-vnpay.png" alt=""></span>';
  }
  function bindDigits(el, format, after) {
    var composing = false;
    function apply() {
      var pos = el.selectionStart == null ? el.value.length : el.selectionStart;
      var before = digits(el.value.slice(0, pos)).length, next = format(digits(el.value));
      if (next !== el.value) {
        el.value = next;
        var p = 0, seen = 0;
        while (p < next.length && seen < before) { if (/\d/.test(next.charAt(p))) seen += 1; p += 1; }
        try { el.setSelectionRange(p, p); } catch (_) {}
      }
      if (after) after();
    }
    el.addEventListener('compositionstart', function () { composing = true; });
    el.addEventListener('compositionend', function () { composing = false; apply(); });
    el.addEventListener('input', function (e) {
      if (composing || e.isComposing) { if (after) after(); return; }
      apply();
    });
  }

  function pickDefault(list) {
    if (list.indexOf(200000) >= 0) return 200000;
    return list[0] || 0;
  }
  function amountOk() {
    var n = Number(state && state.amount) || 0;
    return n >= MIN && n <= MAX;
  }

  function paintBalance() {
    if (!rootEl || !state) return;
    var bal = rootEl.querySelector('[data-wd-bal]');
    var eye = rootEl.querySelector('[data-wd-eye]');
    if (bal) bal.textContent = state.hidden ? '••••••' : vnd(state.balance);
    if (eye) {
      eye.setAttribute('aria-label', state.hidden ? t('wallet.show') : t('wallet.hide'));
      eye.innerHTML = eyeIco(!state.hidden);
    }
  }
  function paintAmount() {
    if (!rootEl || !state) return;
    rootEl.querySelectorAll('[data-wd-amt]').forEach(function (b) {
      var on = Number(b.getAttribute('data-wd-amt')) === state.amount;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var inp = rootEl.querySelector('[data-wd-other]');
    if (inp && document.activeElement !== inp) inp.value = state.custom ? fmtNum(state.amount) : '';
    var cta = rootEl.querySelector('[data-wd-go]');
    if (cta) {
      var ok = amountOk();
      cta.disabled = !ok;
      cta.textContent = ok ? t('wallet.deposit.cta', { amount: vnd(state.amount) }) : t('wallet.deposit.ctaNeed');
    }
  }

  function html() {
    var amounts = state.amounts;
    var chips = amounts.map(function (n) {
      return '<button type="button" class="wd-chip" data-wd-amt="' + n + '" aria-pressed="false">' + esc(fmtNum(n)) + '</button>';
    }).join('');
    var fee = Number(state.fee) || 0;
    return '<div class="wd">' +
      '<header class="app-header"><button type="button" class="app-header__back" data-back data-back-fallback="/wallet" aria-label="Quay lại">‹</button>' +
        '<h1>' + esc(t('wallet.deposit.title')) + '</h1></header>' +
      '<main class="wd-page">' +
        '<section class="wal-card wd-card" style="background-image:url(\'' + CARD_BG + '\')">' +
          '<div class="wal-card__top"><span>' + esc(t('wallet.deposit.balance')) + '</span>' +
            '<button type="button" class="wal-eye" data-wd-eye>' + eyeIco(true) + '</button></div>' +
          '<p class="wal-card__bal" data-wd-bal></p>' +
        '</section>' +
        '<h2 class="wd-h">' + esc(t('wallet.deposit.quick')) + '</h2>' +
        '<div class="wd-chips">' + chips + '</div>' +
        '<label class="wd-other"><span class="wd-other__ico">đ</span>' +
          '<input type="text" inputmode="numeric" autocomplete="off" data-wd-other placeholder="' + esc(t('wallet.deposit.other')) + '"></label>' +
        '<h2 class="wd-h">' + esc(t('wallet.deposit.method')) + '</h2>' +
        '<button type="button" class="wd-pay is-on" data-wd-pay="vnpay" aria-pressed="true">' +
          vnpayLogo() +
          '<span class="wd-pay__copy"><b>' + esc(t('wallet.deposit.vnpay')) + '</b><small>' + esc(t('wallet.deposit.vnpayDesc')) + '</small></span>' +
          '<span class="wd-radio" aria-hidden="true"></span></button>' +
        '<p class="wd-fee"><span>ⓘ</span>' + esc(t('wallet.deposit.fee', { fee: vnd(fee) })) + '</p>' +
      '</main>' +
      '<div class="wd-bar"><button type="button" class="btn btn-primary btn-block" data-wd-go></button></div>' +
    '</div>';
  }

  function bind() {
    if (!rootEl) return;
    rootEl.removeEventListener('click', onClick);
    rootEl.addEventListener('click', onClick);
    var inp = rootEl.querySelector('[data-wd-other]');
    if (inp) {
      bindDigits(inp, function (d) { return fmtNum(Number(d.slice(0, 8)) || 0); }, function () {
        var n = TTV.api.parseMoneyInput(inp.value) || 0;
        state.custom = !!n;
        state.amount = n;
        paintAmount();
      });
    }
  }
  function onClick(e) {
    if (e.target.closest('[data-wd-eye]')) {
      state.hidden = !state.hidden;
      writeHidden(state.hidden);
      paintBalance();
      return;
    }
    var chip = e.target.closest('[data-wd-amt]');
    if (chip) {
      state.amount = Number(chip.getAttribute('data-wd-amt')) || 0;
      state.custom = false;
      paintAmount();
      return;
    }
    if (e.target.closest('[data-wd-go]')) { goPay(); return; }
  }
  function goPay() {
    if (busy || !state) return;
    if (!amountOk()) {
      TTV.Components.toast(t('wallet.deposit.needAmount'), 'danger');
      return;
    }
    var btn = rootEl && rootEl.querySelector('[data-wd-go]');
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = t('wallet.deposit.paying'); }
    TTV.api.startWalletTopup(state.amount).then(function (d) {
      if (d && d.url) { location.href = d.url; return; }
      throw new Error(t('wallet.deposit.payFail'));
    }).catch(function (err) {
      busy = false;
      paintAmount();
      TTV.Components.toast((err && err.message) || t('wallet.deposit.payFail'), 'danger');
    });
  }

  function paint() {
    if (!rootEl || !state) return;
    rootEl.classList.remove('is-wide');
    rootEl.innerHTML = html();
    paintBalance();
    paintAmount();
    bind();
  }
  function paintErr(msg) {
    if (!rootEl) return;
    rootEl.innerHTML = TTV.Components.header(t('wallet.deposit.title'), { back: true }) +
      '<main class="page">' + TTV.Components.emptyState(t('wallet.err'), msg || '') + '</main>';
  }

  function load() {
    return Promise.all([
      TTV.api.getWallet(),
      TTV.api.getSetting('quick_topup_amounts'),
      TTV.api.getSetting('topup_fee')
    ]).then(function (p) {
      var list = Array.isArray(p[1]) ? p[1].map(Number).filter(function (n) { return n >= MIN && n <= MAX; }) : [];
      if (!list.length) list = FALLBACK_AMOUNTS.slice();
      state = {
        balance: Number(p[0] && p[0].balance) || 0,
        amounts: list,
        fee: Number(p[2]) || 0,
        hidden: readHidden(),
        amount: pickDefault(list),
        custom: false
      };
      paint();
    }).catch(function (err) { paintErr(err && err.message); });
  }

  TTV.screens.walletDeposit = {
    render: function (container) {
      TTV.screens.walletDeposit.destroy();
      rootEl = container;
      container.classList.remove('is-wide');
      container.innerHTML = TTV.Components.loading(t('common.loading'));
      load();
    },
    destroy: function () {
      if (rootEl) rootEl.removeEventListener('click', onClick);
      rootEl = null;
      state = null;
      busy = false;
    }
  };
})(window.TTV);
