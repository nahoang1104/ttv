/* screens/admin/settings.js — Giá & cấu hình hệ thống #/admin/settings (task 3.6).
   Chỉ SUPER_ADMIN. Một màn, 3 tab chip (Đơn giá / Phí & tốc độ / Hệ thống), một nút Lưu dính đáy.
   Mọi kiểm tra và ghi nằm ở TTV.api.saveAdminConfig (kiểm quyền, đọc lại trước khi ghi, audit_logs). Màn này chỉ giữ chuỗi người dùng nhập. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var BACK = '/admin/more';
  var TABS = ['price', 'fees', 'system'];
  var token = 0;     // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var host = null;   // vùng nội dung của khung admin
  var state = null;  // { cfg, form, base, tab, errors, busy }

  function fmtMoney(n) { return new Intl.NumberFormat('vi-VN').format(n); }
  function fmtDec(n) { return String(n).replace('.', ','); }

  /* ===== Chuyển cấu hình ↔ dữ liệu form (chuỗi) ===== */
  function formFromConfig(c) {
    var f = { svc: {}, tier: {} }, p = c.pricing, s = c.settings;
    c.services.forEach(function (x) { f.svc[x.code] = fmtMoney(x.base_price); });
    c.tiers.forEach(function (x) { f.tier[x.code] = fmtMoney(x.price); });
    f.floor_fee = fmtMoney(p.floor_fee);
    f.elevator_pct = fmtDec(Math.round(p.elevator_discount * 10000) / 100);
    f.km_fee = fmtMoney(p.km_fee);
    f.speed_fast = fmtDec(p.speed_multipliers.fast);
    f.speed_urgent = fmtDec(p.speed_multipliers.urgent);
    f.min_amount = fmtMoney(p.min_amount);
    f.quote_window_min = String(p.quote_window_min);
    f.commission_default = fmtDec(s.commission_default);
    f.bot_enabled = !!s.demo_quote_bot_enabled;
    f.wallet_negative_limit = fmtMoney(Math.abs(Number(s.vendor_wallet_negative_limit) || 0));
    f.hotline = String(s.hotline || '');
    f.support_email = String(s.support_email || '');
    f.zalo_url = String(s.zalo_url || '');
    f.topup_amounts = (s.quick_topup_amounts || []).slice();
    f.topup_fee = fmtMoney(s.topup_fee);
    return f;
  }
  function snapshot() { return JSON.stringify(state.form); }
  function isDirty() { return !!state && snapshot() !== state.base; }
  function tabOf(key) {
    if (/^(svc_|tier_)/.test(key)) return 'price';
    if (['floor_fee', 'elevator_pct', 'km_fee', 'speed_fast', 'speed_urgent', 'min_amount', 'quote_window_min'].indexOf(key) >= 0) return 'fees';
    return 'system';
  }

  /* ===== Dựng HTML ===== */
  // Ô nhập một dòng. o: key (khóa lỗi + khóa dữ liệu), label, value, hint, inputmode, kind('money'), maxlength, disabled.
  function field(o) {
    var err = state.errors[o.key];
    return '<div class="field' + (err ? ' is-invalid' : '') + '" data-field="' + esc(o.key) + '">' +
      '<label class="field__label" for="cf-' + esc(o.key) + '">' + esc(o.label) + '</label>' +
      '<input id="cf-' + esc(o.key) + '" type="text" autocomplete="off" inputmode="' + (o.inputmode || 'numeric') + '" data-cf="' + esc(o.key) + '"' +
      (o.group ? ' data-cf-group="' + o.group + '"' : '') + (o.kind ? ' data-cf-kind="' + o.kind + '"' : '') +
      (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + (o.disabled ? ' disabled' : '') +
      (o.extra || '') + ' value="' + esc(o.value) + '">' +
      (o.hint ? '<p class="field-hint">' + esc(o.hint) + '</p>' : '') +
      '<p class="field-error" data-error role="alert"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p></div>';
  }
  function moneyField(key, label, value, o) { o = o || {}; return field({ key: key, label: label, value: value, kind: 'money', hint: o.hint, group: o.group, maxlength: 14 }); }
  function section(title, desc, body) {
    return C.card((desc ? '<p class="admin-card-desc">' + esc(desc) + '</p>' : '') + body, { title: title });
  }

  function priceTab() {
    var f = state.form, c = state.cfg;
    var svc = c.services.map(function (x) { return moneyField('svc_' + x.code, (x.icon ? x.icon + ' ' : '') + x.name, f.svc[x.code], { group: 'svc' }); }).join('');
    var tiers = c.tiers.map(function (x) { return moneyField('tier_' + x.code, x.name, f.tier[x.code], { group: 'tier', hint: x.description }); }).join('');
    return section(t('adminCfg.sec.services'), t('adminCfg.sec.services.desc'), svc) + section(t('adminCfg.sec.weight'), t('adminCfg.sec.weight.desc'), tiers);
  }
  function feesTab() {
    var f = state.form;
    var floor = moneyField('floor_fee', t('adminCfg.f.floor_fee'), f.floor_fee, { hint: t('adminCfg.h.floor_fee') }) +
      field({ key: 'elevator_pct', label: t('adminCfg.f.elevator_pct'), value: f.elevator_pct, inputmode: 'decimal', hint: t('adminCfg.h.elevator_pct'), maxlength: 6 }) +
      moneyField('km_fee', t('adminCfg.f.km_fee'), f.km_fee);
    var speed = field({ key: 'speed_default', label: t('adminCfg.f.speed_default'), value: '1', disabled: true }) +
      field({ key: 'speed_fast', label: t('adminCfg.f.speed_fast'), value: f.speed_fast, inputmode: 'decimal', maxlength: 6 }) +
      field({ key: 'speed_urgent', label: t('adminCfg.f.speed_urgent'), value: f.speed_urgent, inputmode: 'decimal', hint: t('adminCfg.h.speed'), maxlength: 6 });
    var rules = moneyField('min_amount', t('adminCfg.f.min_amount'), f.min_amount, { hint: t('adminCfg.h.min_amount') }) +
      field({ key: 'quote_window_min', label: t('adminCfg.f.quote_window_min'), value: f.quote_window_min, hint: t('adminCfg.h.quote_window_min'), maxlength: 4 });
    return section(t('adminCfg.sec.floor'), '', floor) + section(t('adminCfg.sec.speed'), t('adminCfg.sec.speed.desc'), speed) + section(t('adminCfg.sec.rules'), '', rules);
  }
  function topupChips() {
    var list = state.form.topup_amounts;
    return '<div class="admin-amount-chips" id="cf-topup-list">' + list.map(function (a, i) {
      return '<span class="admin-amount-chip">' + esc(fmtMoney(a)) + 'đ<button type="button" data-cf-del="' + i + '" aria-label="' + esc(t('adminCfg.topup.remove', { amount: fmtMoney(a) })) + '">×</button></span>';
    }).join('') + '</div>';
  }
  function systemTab() {
    var f = state.form, err = state.errors.topup_amounts;
    var commission = field({ key: 'commission_default', label: t('adminCfg.f.commission_default'), value: f.commission_default, inputmode: 'decimal', hint: t('adminCfg.h.commission_default'), maxlength: 6 }) +
      moneyField('wallet_negative_limit', t('adminCfg.f.wallet_negative_limit'), f.wallet_negative_limit, { hint: t('adminCfg.h.wallet_negative_limit') });
    var bot = C.toggle(t('adminCfg.f.bot'), f.bot_enabled, { name: 'bot_enabled' }) + '<p class="field-hint">' + esc(t('adminCfg.h.bot')) + '</p>';
    var contact = field({ key: 'hotline', label: t('adminCfg.f.hotline'), value: f.hotline, inputmode: 'tel', maxlength: 20 }) +
      field({ key: 'support_email', label: t('adminCfg.f.support_email'), value: f.support_email, inputmode: 'email', maxlength: 120, extra: ' autocapitalize="off" spellcheck="false"' }) +
      field({ key: 'zalo_url', label: t('adminCfg.f.zalo_url'), value: f.zalo_url, inputmode: 'url', hint: t('adminCfg.h.zalo_url'), maxlength: 200, extra: ' autocapitalize="off" spellcheck="false"' });
    var topup = '<div class="field' + (err ? ' is-invalid' : '') + '" data-field="topup_amounts"><span class="field__label">' + esc(t('adminCfg.f.topup_amounts')) + '</span>' + topupChips() +
      '<div class="admin-inline-add"><input id="cf-topup-new" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="' + esc(t('adminCfg.ph.topup_add')) + '" aria-label="' + esc(t('adminCfg.ph.topup_add')) + '">' +
      '<button type="button" class="btn btn-secondary admin-mini-btn" data-cf-act="add-topup">' + esc(t('adminCfg.btn.topup_add')) + '</button></div>' +
      '<p class="field-hint">' + esc(t('adminCfg.h.topup_amounts')) + '</p><p class="field-error" data-error role="alert"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</p></div>' +
      moneyField('topup_fee', t('adminCfg.f.topup_fee'), f.topup_fee);
    return section(t('adminCfg.sec.commission'), '', commission) + section(t('adminCfg.sec.bot'), '', bot) + section(t('adminCfg.sec.contact'), '', contact) + section(t('adminCfg.sec.topup'), '', topup);
  }
  function tabsHtml() {
    return '<div class="admin-chip-row" id="cf-tabs" role="tablist">' + TABS.map(function (id) {
      var on = state.tab === id;
      return '<button type="button" role="tab" class="chip' + (on ? ' is-selected' : '') + '" data-cf-tab="' + id + '" aria-selected="' + (on ? 'true' : 'false') + '">' + esc(t('adminCfg.tab.' + id)) + '</button>';
    }).join('') + '</div>';
  }
  function bodyHtml() { return state.tab === 'price' ? priceTab() : state.tab === 'fees' ? feesTab() : systemTab(); }
  function barHtml() {
    var dirty = isDirty();
    return '<div class="admin-form-actions admin-form-actions--split"><button type="button" class="btn btn-secondary" data-cf-act="reset" id="cf-reset"' + (dirty && !state.busy ? '' : ' disabled') + '>' + esc(t('adminCfg.btn.reset')) + '</button>' +
      '<button type="submit" class="btn btn-primary" id="cf-submit"' + (dirty && !state.busy ? '' : ' disabled') + '>' + esc(t(state.busy ? 'adminCfg.btn.saving' : 'adminCfg.btn.save')) + '</button></div>';
  }
  function paint() {
    host.innerHTML = '<p class="admin-page-intro">' + esc(t('adminCfg.intro')) + '</p><form id="cf-form" class="admin-form" novalidate>' + tabsHtml() + '<div id="cf-body">' + bodyHtml() + '</div>' + barHtml() + '</form>';
  }
  function paintBody() { host.querySelector('#cf-body').innerHTML = bodyHtml(); }
  function refreshBar() {
    var d = isDirty() && !state.busy, s = host.querySelector('#cf-submit'), r = host.querySelector('#cf-reset');
    if (s) s.disabled = !d; if (r) r.disabled = !d;
  }

  /* ===== Lỗi theo trường ===== */
  function setError(key, msg) {
    var f = host.querySelector('[data-field="' + key + '"]'); if (!f) return;
    var p = f.querySelector('[data-error]'); if (!p) return;
    p.textContent = msg || ''; p.hidden = !msg; f.classList.toggle('is-invalid', !!msg);
  }
  function clearError(key) { if (state.errors[key]) { delete state.errors[key]; setError(key, ''); } }
  function focusFirstError() {
    var el = host.querySelector('.field.is-invalid'); if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var input = el.querySelector('input'); if (input) input.focus({ preventScroll: true });
  }

  /* ===== Thao tác ===== */
  function setTab(id) {
    if (state.tab === id) return;
    state.tab = id;
    host.querySelectorAll('[data-cf-tab]').forEach(function (b) { var on = b.getAttribute('data-cf-tab') === id; b.classList.toggle('is-selected', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    paintBody(); window.scrollTo(0, 0);
  }
  function setValue(el) {
    var key = el.getAttribute('data-cf'), group = el.getAttribute('data-cf-group');
    if (group === 'svc') state.form.svc[key.slice(4)] = el.value;
    else if (group === 'tier') state.form.tier[key.slice(5)] = el.value;
    else state.form[key] = el.value;
    clearError(key); refreshBar();
  }
  function addTopup() {
    var input = host.querySelector('#cf-topup-new'), n = TTV.api.parseMoneyInput(input.value), list = state.form.topup_amounts;
    var msg = '';
    if (n == null || n < 10000 || n > 50000000) msg = t('adminCfg.err.topup');
    else if (list.indexOf(n) >= 0) msg = t('adminCfg.err.topupDup');
    else if (list.length >= 9) msg = t('adminCfg.err.topupMax');
    if (msg) { state.errors.topup_amounts = msg; setError('topup_amounts', msg); return; }
    list.push(n); list.sort(function (a, b) { return a - b; });
    input.value = ''; clearError('topup_amounts');
    host.querySelector('#cf-topup-list').outerHTML = topupChips(); refreshBar();
  }
  function delTopup(i) {
    state.form.topup_amounts.splice(i, 1); clearError('topup_amounts');
    host.querySelector('#cf-topup-list').outerHTML = topupChips(); refreshBar();
  }
  function resetForm() {
    state.form = formFromConfig(state.cfg); state.errors = {};
    paintBody(); refreshBar(); C.toast(t('adminCfg.toast.reverted'), 'info');
  }
  function payload() {
    var f = state.form;
    return { svc: Object.assign({}, f.svc), tier: Object.assign({}, f.tier), floor_fee: f.floor_fee, elevator_pct: f.elevator_pct, km_fee: f.km_fee, speed_fast: f.speed_fast, speed_urgent: f.speed_urgent,
      min_amount: f.min_amount, quote_window_min: f.quote_window_min, commission_default: f.commission_default, bot_enabled: f.bot_enabled, wallet_negative_limit: f.wallet_negative_limit,
      hotline: f.hotline, support_email: f.support_email, zalo_url: f.zalo_url, topup_amounts: f.topup_amounts.slice(), topup_fee: f.topup_fee };
  }
  function onSubmit(e) {
    if (!e.target.closest('#cf-form')) return;
    e.preventDefault();
    if (!state || state.busy || !isDirty()) return;
    var my = token;
    state.busy = true; state.errors = {}; refreshBar();
    host.querySelector('#cf-submit').textContent = t('adminCfg.btn.saving');
    TTV.api.saveAdminConfig(payload()).then(function (res) {
      if (my !== token || !state) return;
      state.busy = false; state.cfg = res.config; state.form = formFromConfig(res.config); state.base = snapshot();
      paintBody(); host.querySelector('#cf-form .admin-form-actions').outerHTML = barHtml();
      C.toast(t(res.changed.length ? 'adminCfg.toast.saved' : 'adminCfg.toast.noChange'), res.changed.length ? 'success' : 'info');
    }).catch(function (err) {
      if (my !== token || !state) return;
      state.busy = false;
      if (err && err.code === 'VALIDATION') {
        state.errors = err.errors || {};
        var first = Object.keys(state.errors)[0]; if (first) { state.tab = tabOf(first); }
        paint(); focusFirstError(); C.toast(t('adminCfg.err.fix'), 'error');
      } else {
        host.querySelector('#cf-form .admin-form-actions').outerHTML = barHtml();
        C.toast((err && err.message) || t('adminCfg.err.generic'), 'error');
      }
    });
  }
  function onClick(e) {
    var el;
    if (!state) { if (e.target.closest('[data-action="cf-retry"]')) load(token); return; }
    if ((el = e.target.closest('[data-cf-tab]'))) { setTab(el.getAttribute('data-cf-tab')); return; }
    if ((el = e.target.closest('[data-cf-del]'))) { delTopup(Number(el.getAttribute('data-cf-del'))); return; }
    if ((el = e.target.closest('[data-cf-act]'))) {
      var a = el.getAttribute('data-cf-act');
      if (a === 'add-topup') addTopup(); else if (a === 'reset' && !state.busy) resetForm();
    }
  }
  function onInput(e) { var el = e.target; if (state && el && el.hasAttribute && el.hasAttribute('data-cf')) setValue(el); }
  function onChange(e) {
    var el = e.target; if (!state || !el || el.name !== 'bot_enabled') return;
    state.form.bot_enabled = el.checked; refreshBar();
  }
  // Rời ô tiền: gọn lại thành dạng có dấu chấm ngăn nghìn nếu hợp lệ.
  function onFocusOut(e) {
    var el = e.target; if (!state || !el || el.getAttribute('data-cf-kind') !== 'money') return;
    var n = TTV.api.parseMoneyInput(el.value);
    if (n != null) { el.value = fmtMoney(n); setValue(el); }
  }
  function onKeydown(e) {
    if (!state || e.key !== 'Enter') return;
    if (e.target && e.target.id === 'cf-topup-new') { e.preventDefault(); addTopup(); }
  }

  /* ===== Vào / rời màn ===== */
  function load(my) {
    host.innerHTML = C.loading();
    TTV.api.getAdminConfig().then(function (cfg) {
      if (my !== token) return;
      var form = formFromConfig(cfg);
      state = { cfg: cfg, form: form, base: JSON.stringify(form), tab: 'price', errors: {}, busy: false };
      paint();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('adminCfg.loadError'), (e && e.message) || t('common.error'), { icon: '!', label: t('adminCfg.retry'), action: 'cf-retry' });
    });
  }
  function render(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    state = null;
    TTV.screens.admin.shell(ctx.path, t('adminCfg.title'), '', s && s.role, { back: BACK, hideNav: true });
    host = document.querySelector('.admin-content');
    host.addEventListener('click', onClick); host.addEventListener('input', onInput); host.addEventListener('change', onChange);
    host.addEventListener('focusout', onFocusOut); host.addEventListener('submit', onSubmit); host.addEventListener('keydown', onKeydown);
    load(my);
  }
  function destroy() { token++; state = null; host = null; }

  TTV.screens.adminSettings = { render: render, destroy: destroy };
  TTV.Router.add('/admin/settings', render, { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy });
})(window.TTV);
