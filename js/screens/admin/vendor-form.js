/* screens/admin/vendor-form.js — Tạo tài khoản thợ #/admin/vendors/new (task 3.3) và Sửa thông tin thợ #/admin/vendors/:id/edit (task 3.4).
   Chỉ SUPER_ADMIN. Ghi qua TTV.api.createVendor / updateVendor (kiểm quyền, kiểm tra trùng, audit_logs; tạo mới còn băm mật khẩu).
   Mật khẩu tạm chỉ nằm trong bộ nhớ của màn hình này để hiển thị một lần; DB chỉ lưu salt + hash. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var BACK = '/admin/vendors';
var mode = 'create', editId = null; // 'edit' khi vào từ #/admin/vendors/:id/edit
  var token = 0;      // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var state = null;   // { services, defaultRate, data, busy, done }
  var host = null;    // vùng nội dung của khung admin

  function newData() { return { type: 'personal', services: [], areas: [], password: TTV.api.generateTempPassword() }; }
  function dataFromVendor(v) {
    return { type: v.type, name: v.name || '', phone: v.phone || '', email: v.email || '', username: v.username || '', team_size: v.team_size || 1,
      services: (v.services || []).slice(), areas: (v.areas || []).slice(), vehicle: v.vehicle || '', commission: v.commission_rate == null ? '' : String(v.commission_rate) };
  }
  function isEdit() { return mode === 'edit'; }

  /* ===== Dựng HTML ===== */
  function chipBtn(attr, value, label, selected) {
    return '<button type="button" class="chip' + (selected ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }
  function errorLine(key) { return '<p class="field-error" data-error="' + key + '" role="alert" hidden></p>'; }
  function hintLine(key, text) { return text ? '<p class="field-hint" data-hint="' + key + '">' + esc(text) + '</p>' : ''; }
  // Ô nhập một dòng. o: type, value, placeholder, inputmode, maxlength, hint, extra (thuộc tính thêm), after (HTML sau ô nhập).
  function inputField(key, labelHtml, o) {
    o = o || {};
    return '<div class="field" data-field="' + key + '"><label class="field__label" for="vf-' + key + '">' + labelHtml + '</label>' +
      '<input id="vf-' + key + '" name="' + key + '" type="' + (o.type || 'text') + '" autocomplete="off"' +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') +
      (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + (o.extra || '') + (o.value != null ? ' value="' + esc(o.value) + '"' : '') + '>' +
      (o.after || '') + hintLine(key, o.hint) + errorLine(key) + '</div>';
  }
  // Nhóm chip (chọn một hoặc nhiều). o: tool (HTML nút phụ bên phải tiêu đề), hint.
  function groupField(key, label, chipsHtml, o) {
    o = o || {};
    return '<div class="field" data-field="' + key + '"><div class="admin-field-head"><span class="field__label" id="vf-lbl-' + key + '">' + esc(label) + ' <b>*</b></span>' + (o.tool || '') + '</div>' +
      '<div class="chips" role="group" aria-labelledby="vf-lbl-' + key + '">' + chipsHtml + '</div>' + hintLine(key, o.hint) + errorLine(key) + '</div>';
  }
  var REQ = ' <b>*</b>';

  function formHtml() {
    var api = TTV.api, d = state.data, lim = api.VENDOR_TEAM_LIMITS[d.type], rate = state.defaultRate == null ? 15 : state.defaultRate;
    var typeChips = api.VENDOR_TYPES.map(function (x) { return chipBtn('data-vf-type', x.value, t('adminVendor.type.' + x.value), d.type === x.value); }).join('');
    var svcChips = state.services.length
      ? state.services.map(function (s) { var code = s.code || s.id; return chipBtn('data-vf-svc', code, (s.icon ? s.icon + ' ' : '') + s.name, d.services.indexOf(code) >= 0); }).join('')
      : '<p class="muted">' + esc(t('adminVendor.noServices')) + '</p>';
    var areaChips = api.VENDOR_AREAS.map(function (a) { return chipBtn('data-vf-area', a.value, a.label, d.areas.indexOf(a.value) >= 0); }).join('');
    var pwActions = '<div class="admin-pw-actions"><button type="button" class="btn btn-secondary admin-mini-btn" data-vf="gen">' + esc(t('adminVendor.btn.generate')) + '</button>' +
      '<button type="button" class="btn btn-secondary admin-mini-btn" data-vf="copy-pw">' + esc(t('adminVendor.btn.copy')) + '</button></div>';

    var info = groupField('type', t('adminVendor.field.type'), typeChips) +
      inputField('name', esc(t('adminVendor.field.name.' + d.type)) + REQ, { value: d.name, placeholder: t('adminVendor.ph.name.' + d.type), maxlength: 80 }) +
      inputField('phone', esc(t('adminVendor.field.phone')) + REQ, { type: 'tel', inputmode: 'tel', value: d.phone, placeholder: t('adminVendor.ph.phone'), maxlength: 16 }) +
      inputField('email', esc(t('adminVendor.field.email')) + REQ, { type: 'email', inputmode: 'email', value: d.email, placeholder: t('adminVendor.ph.email'), maxlength: 120, extra: ' autocapitalize="off" spellcheck="false"' });
    var account = isEdit()
      ? inputField('username', esc(t('adminVendor.field.username')), { value: d.username, extra: ' disabled readonly' })
      : inputField('username', esc(t('adminVendor.field.username')) + REQ, { placeholder: t('adminVendor.ph.username'), maxlength: 30, hint: t('adminVendor.hint.username'), extra: ' autocapitalize="off" spellcheck="false"' }) +
        inputField('password', esc(t('adminVendor.field.password')) + REQ, { value: d.password, maxlength: 64, hint: t('adminVendor.hint.password'), extra: ' class="admin-pw-input" autocapitalize="off" spellcheck="false"', after: pwActions });
    var capacity = inputField('team_size', esc(t('adminVendor.field.teamSize')) + REQ, {
        type: 'number', inputmode: 'numeric', value: d.team_size || 1, extra: ' min="' + lim.min + '" max="' + lim.max + '" step="1"' + (d.type === 'personal' ? ' disabled' : ''),
        hint: d.type === 'personal' ? t('adminVendor.hint.teamPersonal') : t('adminVendor.hint.teamRange', { min: lim.min, max: lim.max }) }) +
      groupField('services', t('adminVendor.field.services'), svcChips, { tool: '<button type="button" class="link-btn" data-vf="toggle-services">' + esc(t('adminVendor.btn.selectAll')) + '</button>' }) +
      groupField('areas', t('adminVendor.field.areas'), areaChips, { hint: t('adminVendor.hint.areas') }) +
      inputField('vehicle', esc(t('adminVendor.field.vehicle')), { value: d.vehicle, placeholder: t('adminVendor.ph.vehicle'), maxlength: 60, hint: t('adminVendor.hint.vehicle'), extra: ' list="vf-vehicles"',
        after: '<datalist id="vf-vehicles">' + api.VENDOR_VEHICLES.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('') + '</datalist>' });
    var commission = inputField('commission', esc(t('adminVendor.field.commission')), { type: 'text', inputmode: 'decimal', value: d.commission, placeholder: t('adminVendor.ph.commission', { rate: rate }), maxlength: 6, hint: t('adminVendor.hint.commission', { rate: rate }) });

    return '<p class="admin-page-intro">' + esc(t(isEdit() ? 'adminVendors.edit.intro' : 'adminVendor.intro')) + '</p>' +
      '<form id="vf-form" class="admin-form" novalidate>' +
      C.card(info, { title: t('adminVendor.section.info') }) + C.card(account, { title: t('adminVendor.section.account') }) +
      C.card(capacity, { title: t('adminVendor.section.capacity') }) + C.card(commission, { title: t('adminVendor.section.commission') }) +
      '<div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-block" id="vf-submit">' + esc(t(isEdit() ? 'adminVendors.edit.submit' : 'adminVendor.submit')) + '</button></div></form>';
  }

  // Màn kết quả: hiển thị thông tin đăng nhập một lần.
  function doneHtml() {
    var dn = state.done;
    function row(label, value, action) {
      return '<div class="admin-cred__row"><div><span class="admin-cred__label">' + esc(label) + '</span><b class="admin-cred__value">' + esc(value) + '</b></div>' +
        '<button type="button" class="btn btn-secondary admin-mini-btn" data-vf="' + action + '">' + esc(t('adminVendor.btn.copy')) + '</button></div>';
    }
    return '<section class="admin-done"><div class="admin-done__icon" aria-hidden="true">✓</div><h2>' + esc(t('adminVendor.done.title')) + '</h2>' +
      '<p>' + esc(t('adminVendor.done.sub', { name: dn.vendor.name })) + '</p>' +
      '<div class="admin-cred">' + row(t('adminVendor.done.username'), dn.username, 'copy-user') + row(t('adminVendor.done.password'), dn.password, 'copy-done-pw') + '</div>' +
      C.notice(t('adminVendor.done.warn'), t('adminVendor.done.warnTitle')) +
      '<div class="admin-done__actions">' +
      '<button type="button" class="btn btn-primary btn-block" data-vf="copy-all">' + esc(t('adminVendor.done.copyAll')) + '</button>' +
      '<button type="button" class="btn btn-secondary btn-block" data-vf="another">' + esc(t('adminVendor.done.another')) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-admin-route="' + BACK + '">' + esc(t('adminVendor.done.back')) + '</button></div></section>';
  }

  /* ===== Lỗi theo trường ===== */
  function fieldEl(key) { return host && host.querySelector('[data-field="' + key + '"]'); }
  function setError(key, msg) {
    var f = fieldEl(key); if (!f) return;
    var p = f.querySelector('[data-error]'); if (!p) return;
    p.textContent = msg || ''; p.hidden = !msg; f.classList.toggle('is-invalid', !!msg);
  }
  function clearError(key) { setError(key, ''); }
  function showErrors(errors) {
    errors = errors || {};
    host.querySelectorAll('[data-field]').forEach(function (f) { var k = f.getAttribute('data-field'); setError(k, errors[k] || ''); });
    // commission/vehicle... đều dùng cùng khóa với data-field; khóa API commission_rate ↔ ô commission
    if (errors.commission_rate) setError('commission', errors.commission_rate);
  }
  function focusFirstError() {
    var f = host.querySelector('.field.is-invalid'); if (!f) return;
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var input = f.querySelector('input'); if (input && !input.disabled) input.focus({ preventScroll: true });
  }

  /* ===== Hành vi form ===== */
  function applyType() {
    var d = state.data, lim = TTV.api.VENDOR_TEAM_LIMITS[d.type];
    host.querySelectorAll('[data-vf-type]').forEach(function (b) { var on = b.getAttribute('data-vf-type') === d.type; b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var label = host.querySelector('[data-field="name"] .field__label'); if (label) label.innerHTML = esc(t('adminVendor.field.name.' + d.type)) + REQ;
    var name = host.querySelector('#vf-name'); if (name) name.placeholder = t('adminVendor.ph.name.' + d.type);
    var size = host.querySelector('#vf-team_size'), hint = host.querySelector('[data-hint="team_size"]');
    if (size) {
      size.min = lim.min; size.max = lim.max;
      if (d.type === 'personal') { size.value = 1; size.disabled = true; }
      else {
        size.disabled = false;
        var n = Number(size.value);
        if (!Number.isInteger(n) || n < lim.min) size.value = d.type === 'team' ? 3 : 10; else if (n > lim.max) size.value = lim.max;
      }
    }
    if (hint) hint.textContent = d.type === 'personal' ? t('adminVendor.hint.teamPersonal') : t('adminVendor.hint.teamRange', { min: lim.min, max: lim.max });
    clearError('type'); clearError('team_size');
  }
  function setChip(el, on) { el.classList.toggle('is-selected', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function refreshServiceTool() {
    var btn = host.querySelector('[data-vf="toggle-services"]'); if (!btn) return;
    var all = state.services.length > 0 && state.data.services.length === state.services.length;
    btn.textContent = t(all ? 'adminVendor.btn.clearAll' : 'adminVendor.btn.selectAll');
  }
  function toggleService(code, el) {
    var list = state.data.services, i = list.indexOf(code);
    if (i >= 0) list.splice(i, 1); else list.push(code);
    setChip(el, i < 0); refreshServiceTool(); clearError('services');
  }
  function toggleAllServices() {
    var all = state.services.length > 0 && state.data.services.length === state.services.length;
    state.data.services = all ? [] : state.services.map(function (s) { return s.code || s.id; });
    host.querySelectorAll('[data-vf-svc]').forEach(function (b) { setChip(b, state.data.services.indexOf(b.getAttribute('data-vf-svc')) >= 0); });
    refreshServiceTool(); clearError('services');
  }
  // "Toàn TP.HCM" loại trừ các quận/huyện (đã bao gồm hết) và ngược lại.
  function toggleArea(value) {
    var city = TTV.api.VENDOR_CITY_AREA, list = state.data.areas, i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1);
    else if (value === city) { list.length = 0; list.push(city); }
    else { var ci = list.indexOf(city); if (ci >= 0) list.splice(ci, 1); list.push(value); }
    host.querySelectorAll('[data-vf-area]').forEach(function (b) { setChip(b, list.indexOf(b.getAttribute('data-vf-area')) >= 0); });
    clearError('areas');
  }

  function copyText(text) {
    function ok() { C.toast(t('adminVendor.copied'), 'success'); }
    function fail() { C.toast(t('adminVendor.copyFailed'), 'error'); }
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) { navigator.clipboard.writeText(text).then(ok, fail); return; }
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    var done = false; try { done = document.execCommand('copy'); } catch (_) {}
    ta.remove(); if (done) ok(); else fail();
  }
  function copyAllText() {
    var dn = state.done, url = location.href.split('#')[0] + '#/staff-login';
    return [t('adminVendor.copy.header'), t('adminVendor.copy.name') + ': ' + dn.vendor.name, t('adminVendor.done.username') + ': ' + dn.username,
      t('adminVendor.done.password') + ': ' + dn.password, t('adminVendor.copy.login') + ': ' + url].join('\n');
  }

  function action(name) {
    if (!state) return;
    if (name === 'gen') { var pw = host.querySelector('#vf-password'); pw.value = TTV.api.generateTempPassword(); clearError('password'); }
    else if (name === 'copy-pw') copyText(host.querySelector('#vf-password').value);
    else if (name === 'toggle-services') toggleAllServices();
    else if (name === 'copy-user') copyText(state.done.username);
    else if (name === 'copy-done-pw') copyText(state.done.password);
    else if (name === 'copy-all') copyText(copyAllText());
    else if (name === 'another') { state.data = newData(); state.done = null; state.busy = false; paintForm(); window.scrollTo(0, 0); }
  }

  function collect() {
    var d = state.data;
    function v(id) { var el = host.querySelector('#vf-' + id); return el ? el.value : ''; }
    return { type: d.type, name: v('name'), phone: v('phone'), email: v('email'), username: v('username'), password: v('password'),
      team_size: d.type === 'personal' ? 1 : v('team_size'), services: d.services.slice(), areas: d.areas.slice(), vehicle: v('vehicle'), commission_rate: v('commission') };
  }

  function onSubmit(e) {
    if (!e.target.closest('#vf-form')) return;
    e.preventDefault();
    if (!state || state.busy) return;
    var my = token, payload = collect(), btn = host.querySelector('#vf-submit');
    state.busy = true; btn.disabled = true; btn.textContent = t(isEdit() ? 'adminVendors.edit.submitting' : 'adminVendor.submitting'); showErrors({});
    var job = isEdit() ? TTV.api.updateVendor(editId, payload) : TTV.api.createVendor(payload);
    job.then(function (result) {
      if (my !== token || !state) return;
      if (isEdit()) { // lưu xong quay về chi tiết
        C.toast(t(result.changed.length ? 'adminVendors.toast.updated' : 'adminVendors.toast.noChange'), result.changed.length ? 'success' : 'info');
        TTV.Router.navigate(BACK + '/' + encodeURIComponent(editId), { replace: true });
        return;
      }
      var vendor = result;
      state.busy = false; state.done = { vendor: vendor, username: vendor.username, password: payload.password };
      host.innerHTML = doneHtml(); window.scrollTo(0, 0);
    }).catch(function (err) {
      if (my !== token || !state) return;
      state.busy = false;
      var b = host.querySelector('#vf-submit'); if (b) { b.disabled = false; b.textContent = t(isEdit() ? 'adminVendors.edit.submit' : 'adminVendor.submit'); }
      if (err && err.code === 'VALIDATION') { showErrors(err.errors); focusFirstError(); C.toast(t('adminVendor.err.fix'), 'error'); }
      else C.toast((err && err.message) || t(isEdit() ? 'adminVendors.err.generic' : 'adminVendor.err.generic'), 'error');
    });
  }
  function onClick(e) {
    var el;
    if (!state) {
      if (e.target.closest('[data-action="vf-retry"]')) load(token);
      else if (e.target.closest('[data-action="vf-back"]')) TTV.Router.navigate(BACK);
      return;
    }
    if ((el = e.target.closest('[data-vf-type]'))) { if (state.data.type !== el.getAttribute('data-vf-type')) { state.data.type = el.getAttribute('data-vf-type'); applyType(); } return; }
    if ((el = e.target.closest('[data-vf-svc]'))) { toggleService(el.getAttribute('data-vf-svc'), el); return; }
    if ((el = e.target.closest('[data-vf-area]'))) { toggleArea(el.getAttribute('data-vf-area')); return; }
    if ((el = e.target.closest('[data-vf]'))) action(el.getAttribute('data-vf'));
  }
  function onInput(e) {
    var input = e.target; if (!input || input.tagName !== 'INPUT') return;
    if (input.id === 'vf-username' && input.value !== input.value.toLowerCase()) input.value = input.value.toLowerCase(); // đăng nhập không phân biệt hoa thường
    var f = input.closest('[data-field]'); if (f) clearError(f.getAttribute('data-field'));
  }
  // Rời ô tên đăng nhập: báo ngay nếu sai định dạng hoặc đã có người dùng.
  function onFocusOut(e) {
    var input = e.target; if (!state || !input || input.id !== 'vf-username') return;
    var val = input.value.trim().toLowerCase(), my = token; if (!val) return;
    var msg = TTV.api.validateUsername(val);
    if (msg) { setError('username', msg); return; }
    TTV.api.isUsernameTaken(val).then(function (taken) {
      if (taken && my === token && state && input.value.trim().toLowerCase() === val) setError('username', t('adminVendor.err.taken'));
    }).catch(function () {});
  }

  /* ===== Vào / rời màn ===== */
  function paintForm() { host.innerHTML = formHtml(); }
  function loadError(msgKey, retry) { host.innerHTML = C.emptyState(t(msgKey), t('common.error'), retry ? { icon: '!', label: t('adminVendor.retry'), action: 'vf-retry' } : { icon: '?', label: t('adminVendors.detail.back'), action: 'vf-back' }); }
  function load(my) {
    host.innerHTML = C.loading();
    var jobs = [TTV.api.listServices(), TTV.api.getSetting('commission_default')];
    if (isEdit()) jobs.push(TTV.api.getVendor(editId));
    Promise.all(jobs).then(function (r) {
      if (my !== token) return;
      if (isEdit() && !r[2]) { loadError('adminVendors.detail.notFound', false); return; }
      state = { services: r[0], defaultRate: r[1], data: isEdit() ? dataFromVendor(r[2]) : newData(), busy: false, done: null };
      paintForm();
    }).catch(function () {
      if (my !== token) return;
      loadError('adminVendor.loadError', true);
    });
  }
  function render(ctx) {
    var session = TTV.auth.getSession(), my = ++token;
    state = null;
    mode = ctx.params && ctx.params.id ? 'edit' : 'create'; editId = mode === 'edit' ? ctx.params.id : null;
    var back = isEdit() ? BACK + '/' + encodeURIComponent(editId) : BACK;
    TTV.screens.admin.shell(ctx.path, t(isEdit() ? 'adminVendors.edit.title' : 'adminVendor.title'), '', session && session.role, { back: back, hideNav: true });
    host = document.querySelector('.admin-content');
    host.addEventListener('click', onClick); host.addEventListener('input', onInput);
    host.addEventListener('focusout', onFocusOut); host.addEventListener('submit', onSubmit);
    load(my);
  }
  function destroy() { token++; state = null; host = null; } // bỏ mật khẩu tạm khỏi bộ nhớ khi rời màn

  TTV.screens.adminVendorForm = { render: render, destroy: destroy, copyText: copyText };
  TTV.Router.add('/admin/vendors/new', render, { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy });
  TTV.Router.add('/admin/vendors/:id/edit', render, { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy });
})(window.TTV);
