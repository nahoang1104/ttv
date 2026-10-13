/* Báo giá (thợ) — task 5.4, dùng chung cho đơn 1 thợ và đơn ≥ 2 thợ.
   Gắn vào ô đáy của Chi tiết đơn (5.3) qua TTV.screens.vendorOrder.registerActions.
   Trạng thái ô đáy: chưa báo → nút "Báo giá"; đã báo (chờ chọn) → thanh giá + Rút / Sửa; không báo được → dòng lý do. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var ETA_CHOICES = [15, 30, 45, 60], MSG_MAX = 200, busy = false;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function fmtNum(n) { return n ? new Intl.NumberFormat('vi-VN').format(n) : ''; }
  function pendingQuote(v) { return v.my_quote && v.my_quote.status === 'pending' ? v.my_quote : null; }
  function closeSheets() { document.querySelectorAll('.sheet-backdrop[data-vq-sheet]').forEach(function (el) { el.remove(); }); }
  function openSheet(html) {
    closeSheets();
    document.body.insertAdjacentHTML('beforeend', html);
    var el = document.body.lastElementChild;
    el.setAttribute('data-vq-sheet', '');
    return el;
  }
  function errText(err) { return (err && err.message) || t('common.error'); }
  // Lỗi do trạng thái đơn đổi (đã ghép, hết hạn, không đủ điều kiện…): đóng form, báo và tải lại chi tiết
  var STATE_ERRORS = { ORDER_TAKEN: 1, UNAVAILABLE: 1, NOT_ELIGIBLE: 1, OFFLINE: 1, WALLET_LOCKED: 1, QUOTE_LOCKED: 1, QUOTE_INACTIVE: 1, ORDER_NOT_FOUND: 1 };

  /* ----- Ô đáy ----- */
  function barMarkup(v, q) {
    var canEdit = v.action === 'quote';
    return '<div class="vq-bar"><div class="vq-bar__info"><small>' + esc(t('vendorQuote.mine')) + '</small><b>' + esc(vnd(q.price)) + '</b>' +
      '<span>' + esc(t('vendorQuote.eta', { n: q.eta_min })) + ' · ' + esc(t('vendorQuote.waiting')) + '</span></div>' +
      '<div class="vq-bar__btns"><button type="button" class="btn btn-secondary" data-vq="withdraw">' + esc(t('vendorQuote.withdraw')) + '</button>' +
      '<button type="button" class="btn btn-primary"' + (canEdit ? '' : ' disabled') + ' data-vq="edit">' + esc(t('vendorQuote.edit')) + '</button></div></div>' +
      (q.message ? '<p class="vq-msg">“' + esc(q.message) + '”</p>' : '') +
      (canEdit ? '' : '<p class="vq-reason">' + esc(reasonText(v)) + '</p>');
  }
  function reasonText(v) {
    if (v.block_reason === 'not_fit' && v.fit_message) return v.fit_message;
    var k = 'vendorQuote.block.' + v.block_reason, s = t(k);
    return s === k ? t('vendorQuote.block.other') : s;
  }
  function mount(slot, v, reload) {
    if (!v || v.status !== 'finding') return false; // đơn đã ghép / hủy: việc của 5.8
    var q = pendingQuote(v), html;
    if (q) html = barMarkup(v, q);
    else if (v.action === 'quote') {
      html = '<button type="button" class="btn btn-primary btn-block" data-vq="open">' + esc(t('vendorQuote.cta')) + '</button>' +
        '<p class="vq-hint">' + esc(t('vendorQuote.hint', { max: vnd(v.offer) })) + '</p>';
    } else html = '<p class="vq-reason vq-reason--solo">' + esc(reasonText(v)) + '</p>';
    slot.innerHTML = html;
    slot.onclick = function (e) {
      var b = e.target.closest('[data-vq]'); if (!b || b.disabled) return;
      var act = b.getAttribute('data-vq');
      if (act === 'open' || act === 'edit') openForm(v, q, reload);
      else if (act === 'withdraw') openWithdraw(v, reload);
    };
    return true;
  }

  /* ----- Form báo giá (bottom sheet) ----- */
  function formBody(v, q) {
    var price = q ? q.price : 0, eta = q ? q.eta_min : 30, msg = q ? q.message : '';
    return '<div class="vq-form">' +
      '<p class="vq-limits">' + esc(t('vendorQuote.limits', { max: vnd(v.offer), min: vnd(v.min_amount) })) + '</p>' +
      '<label class="vq-field"><span>' + esc(t('vendorQuote.price')) + '</span>' +
        '<div class="vq-money"><input type="text" inputmode="numeric" autocomplete="off" data-vq-price placeholder="0" value="' + esc(fmtNum(price)) + '"><i>đ</i></div>' +
        '<button type="button" class="vq-link" data-vq-max>' + esc(t('vendorQuote.useMax')) + '</button>' +
        '<p class="field-error" data-vq-err="price" hidden></p></label>' +
      '<div class="vq-field"><span>' + esc(t('vendorQuote.etaLabel')) + '</span>' +
        '<div class="vq-money"><input type="text" inputmode="numeric" autocomplete="off" data-vq-eta value="' + esc(eta || '') + '"><i>' + esc(t('vendorQuote.minutes')) + '</i></div>' +
        '<div class="vq-chips">' + ETA_CHOICES.map(function (m) { return '<button type="button" class="chip" data-vq-etachip="' + m + '">' + m + ' ' + esc(t('vendorQuote.minutes')) + '</button>'; }).join('') + '</div>' +
        '<p class="field-error" data-vq-err="eta_min" hidden></p></div>' +
      '<label class="vq-field"><span>' + esc(t('vendorQuote.message')) + '</span>' +
        '<textarea rows="3" maxlength="' + MSG_MAX + '" data-vq-msg placeholder="' + esc(t('vendorQuote.messagePh')) + '">' + esc(msg) + '</textarea>' +
        '<small class="vq-count" data-vq-count>' + (msg ? msg.length : 0) + '/' + MSG_MAX + '</small>' +
        '<p class="field-error" data-vq-err="message" hidden></p></label>' +
      '<p class="field-error" data-vq-err="_" hidden></p></div>';
  }
  function setErr(sheet, key, text) {
    var el = sheet.querySelector('[data-vq-err="' + key + '"]'); if (!el) return;
    el.textContent = text || ''; el.hidden = !text;
  }
  function openForm(v, q, reload) {
    var footer = '<div class="vq-footer"><button type="button" class="btn btn-secondary" data-sheet-close>' + esc(t('common.cancel')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-vq-submit>' + esc(t(q ? 'vendorQuote.save' : 'vendorQuote.send')) + '</button></div>';
    var sheet = openSheet(C.sheet(t(q ? 'vendorQuote.titleEdit' : 'vendorQuote.title'), formBody(v, q), { footer: footer }));
    var priceEl = sheet.querySelector('[data-vq-price]'), etaEl = sheet.querySelector('[data-vq-eta]'), msgEl = sheet.querySelector('[data-vq-msg]');
    var sendBtn = sheet.querySelector('[data-vq-submit]');
    priceEl.addEventListener('input', function () { priceEl.value = fmtNum(Number(digits(priceEl.value)) || 0); setErr(sheet, 'price', ''); setErr(sheet, '_', ''); });
    etaEl.addEventListener('input', function () { etaEl.value = digits(etaEl.value).slice(0, 3); setErr(sheet, 'eta_min', ''); });
    msgEl.addEventListener('input', function () { sheet.querySelector('[data-vq-count]').textContent = msgEl.value.length + '/' + MSG_MAX; setErr(sheet, 'message', ''); });
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-vq-max]')) { priceEl.value = fmtNum(v.offer); setErr(sheet, 'price', ''); return; }
      var chip = e.target.closest('[data-vq-etachip]');
      if (chip) { etaEl.value = chip.getAttribute('data-vq-etachip'); setErr(sheet, 'eta_min', ''); return; }
      if (!e.target.closest('[data-vq-submit]') || busy) return;
      submit();
    });
    function submit() {
      ['price', 'eta_min', 'message', '_'].forEach(function (k) { setErr(sheet, k, ''); });
      busy = true; sendBtn.disabled = true; sendBtn.textContent = t('vendorQuote.sending');
      TTV.api.submitQuote({
        order_id: v.id, price: Number(digits(priceEl.value)) || 0, eta_min: Number(digits(etaEl.value)) || 0, message: msgEl.value
      }).then(function () {
        busy = false; closeSheets();
        C.toast(t(q ? 'vendorQuote.saved' : 'vendorQuote.sent'), 'success');
        reload();
      }).catch(function (err) {
        busy = false; sendBtn.disabled = false; sendBtn.textContent = t(q ? 'vendorQuote.save' : 'vendorQuote.send');
        if (err && err.code === 'VALIDATION' && err.errors) {
          Object.keys(err.errors).forEach(function (k) { setErr(sheet, k, err.errors[k]); });
        } else if (err && STATE_ERRORS[err.code]) {
          closeSheets(); C.toast(errText(err), 'danger'); reload();
        } else setErr(sheet, '_', errText(err));
      });
    }
  }

  /* ----- Rút báo giá ----- */
  function openWithdraw(v, reload) {
    var body = '<p class="vq-confirm">' + esc(t('vendorQuote.withdrawAsk')) + '</p><p class="vq-confirm vq-confirm--sub">' + esc(t('vendorQuote.withdrawNote')) + '</p>' +
      '<p class="field-error" data-vq-err="_" hidden></p>';
    var footer = '<div class="vq-footer"><button type="button" class="btn btn-secondary" data-sheet-close>' + esc(t('vendorQuote.keep')) + '</button>' +
      '<button type="button" class="btn btn-danger" data-vq-confirm>' + esc(t('vendorQuote.withdraw')) + '</button></div>';
    var sheet = openSheet(C.sheet(t('vendorQuote.withdrawTitle'), body, { footer: footer }));
    sheet.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-vq-confirm]'); if (!btn || busy) return;
      busy = true; btn.disabled = true;
      TTV.api.withdrawQuote(v.id).then(function () {
        busy = false; closeSheets(); C.toast(t('vendorQuote.withdrawn'), 'success'); reload();
      }).catch(function (err) {
        busy = false; btn.disabled = false;
        if (err && STATE_ERRORS[err.code]) { closeSheets(); C.toast(errText(err), 'danger'); reload(); }
        else setErr(sheet, '_', errText(err));
      });
    });
  }

  TTV.screens = TTV.screens || {};
  TTV.screens.vendorQuote = { mount: mount };
  if (TTV.screens.vendorOrder && TTV.screens.vendorOrder.registerActions) TTV.screens.vendorOrder.registerActions(mount);
})(window.TTV);
