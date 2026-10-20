/* Hồ sơ thợ — #/vendor/info, mở từ tab Cá nhân (task 9.6).
   Thợ tự sửa: ảnh đại diện, họ tên, số điện thoại, phương tiện, dịch vụ nhận đơn, khu vực hoạt động. (Không có giấy tờ — đã bỏ cùng 3.5.)
   Loại hình, số thợ, tên đăng nhập, hoa hồng: chỉ đọc (admin sửa ở 3.4).
   Ảnh: chọn → xem trước, chỉ ghi file vào uploads/{id thợ}/avatar/ khi bấm Lưu (thoát giữa chừng không để file mồ côi);
   lưu nguyên bản, không nén; DB chỉ lưu đường dẫn. Dịch vụ/khu vực đổi xong có hiệu lực ngay ở Chợ đơn. */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var MAX_AVATAR_BYTES = 10 * 1024 * 1024; // chỉ chặn file quá lớn
  var token = 0, rootEl = null, clickHandler = null, changeHandler = null, inputHandler = null;
  var st = null; // { vendor, services, sel{services,areas}, form{name,phone,vehicle}, file, preview, removeAvatar, errors, busy }

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function initial(name) { return String(name || '?').trim().charAt(0).toUpperCase() || '?'; }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    return a.every(function (x) { return b.indexOf(x) >= 0; });
  }
  function revokePreview() { if (st && st.preview) { try { URL.revokeObjectURL(st.preview); } catch (_) {} st.preview = ''; } }

  function currentAvatar() {
    if (st.removeAvatar) return '';
    return st.preview || (st.vendor && st.vendor.avatar_path) || '';
  }
  function avatarInner() {
    var src = currentAvatar();
    return src ? '<img src="' + esc(src) + '" alt="" data-vi-img>' : '<span class="avatar-initial">' + esc(initial(st.vendor.name)) + '</span>';
  }
  function formOf(v) { return { name: v.name || '', phone: v.phone || '', vehicle: v.vehicle || '' }; }
  function isDirty() {
    var v = st.vendor, f0 = formOf(v), f = st.form;
    return !!st.file || st.removeAvatar ||
      f.name.trim().replace(/\s+/g, ' ') !== f0.name || f.phone.trim() !== f0.phone || f.vehicle.trim().replace(/\s+/g, ' ') !== f0.vehicle ||
      !sameSet(st.sel.services, v.services || []) || !sameSet(st.sel.areas, v.areas || []);
  }
  function shell(inner) {
    return '<div class="vendor vo vi">' +
      '<header class="app-header"><button type="button" class="app-header__back" data-back data-back-fallback="/vendor/profile" aria-label="Quay lại">‹</button>' +
      '<h1>' + esc(t('vendorInfo.title')) + '</h1></header>' + inner + '</div>';
  }
  function row(label, value) {
    return '<div class="vi-row"><span>' + esc(label) + '</span><b>' + esc(value || '—') + '</b></div>';
  }
  function chip(attr, value, label, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }
  function errLine(key) {
    return '<p class="field-error vi-err" data-vi-err="' + key + '"' + (st.errors[key] ? '' : ' hidden') + '>' + esc(st.errors[key] || '') + '</p>';
  }
  function paintBody() {
    var v = st.vendor, allOn = st.services.length > 0 && st.sel.services.length === st.services.length;
    var typeText = t('adminVendor.type.' + (v.type || 'personal')) + (Number(v.team_size) > 1 ? ' · ' + t('vendor.team', { n: v.team_size }) : '');
    var hasAvatar = !!currentAvatar();
    return '<main class="vo-main vi-main">' +
      '<div class="info-avatar"><div class="info-avatar__img" id="vi-avatar">' + avatarInner() + '</div>' +
        '<label class="info-avatar__change"><span>' + esc(t('vendorInfo.avatar.change')) + '</span><input type="file" id="vi-file" accept="image/*" hidden></label>' +
        (hasAvatar ? '<button type="button" class="link-btn vi-remove" data-vi="remove-avatar">' + esc(t('vendorInfo.avatar.remove')) + '</button>' : '') +
        '<p class="vi-hint">' + esc(t('vendorInfo.avatar.hint')) + '</p>' + errLine('avatar') + '</div>' +

      '<section class="card vi-card"><h3 class="card__title">' + esc(t('vendorInfo.section.contact')) + '</h3>' +
        '<label class="field"><span class="field__label">' + esc(t('vendorInfo.field.name')) + '</span>' +
          '<input type="text" data-vi-input="name" maxlength="80" autocomplete="name" value="' + esc(st.form.name) + '"></label>' + errLine('name') +
        '<label class="field"><span class="field__label">' + esc(t('vendorInfo.field.phone')) + '</span>' +
          '<input type="tel" data-vi-input="phone" inputmode="tel" maxlength="20" autocomplete="tel" value="' + esc(st.form.phone) + '"></label>' + errLine('phone') +
        '<label class="field"><span class="field__label">' + esc(t('vendorInfo.field.vehicle')) + '</span>' +
          '<input type="text" data-vi-input="vehicle" maxlength="60" list="vi-vehicles" placeholder="' + esc(t('vendorInfo.vehicle.placeholder')) + '" value="' + esc(st.form.vehicle) + '"></label>' +
          '<datalist id="vi-vehicles">' + TTV.api.VENDOR_VEHICLES.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' + errLine('vehicle') +
      '</section>' +

      '<section class="card vi-card"><h3 class="card__title">' + esc(t('vendorInfo.section.basic')) + '</h3>' +
        row(t('vendorInfo.field.type'), typeText) +
        row(t('vendorInfo.field.username'), v.username ? '@' + v.username : '') +
        '<p class="vi-hint vi-hint--left">' + esc(t('vendorInfo.basic.hint')) + '</p></section>' +

      '<section class="card vi-card"><div class="vi-head"><h3 class="card__title">' + esc(t('vendorInfo.services')) + '</h3>' +
        '<button type="button" class="link-btn" data-vi="toggle-services">' + esc(t(allOn ? 'vendorInfo.services.none' : 'vendorInfo.services.all')) + '</button></div>' +
        '<p class="vi-hint vi-hint--left">' + esc(t('vendorInfo.services.hint')) + '</p>' +
        '<div class="chips vi-chips">' + st.services.map(function (s) {
          var code = String(s.code || s.id);
          return chip('data-vi-svc', code, (s.icon ? s.icon + ' ' : '') + s.name, st.sel.services.indexOf(code) >= 0);
        }).join('') + '</div>' + errLine('services') + '</section>' +

      '<section class="card vi-card"><h3 class="card__title">' + esc(t('vendorInfo.areas')) + '</h3>' +
        '<p class="vi-hint vi-hint--left">' + esc(t('vendorInfo.areas.hint')) + '</p>' +
        '<div class="chips vi-chips">' + TTV.api.VENDOR_AREAS.map(function (a) {
          return chip('data-vi-area', a.value, a.label, st.sel.areas.indexOf(a.value) >= 0);
        }).join('') + '</div>' + errLine('areas') + '</section>' +

      '<p class="field-error vi-err" id="vi-error" role="alert"' + (st.errors.form ? '' : ' hidden') + '>' + esc(st.errors.form || '') + '</p>' +
      '</main>' +
      '<div class="page-action vi-action"><button type="button" class="btn btn-primary btn-block" data-vi="save" id="vi-save"' +
        (isDirty() && !st.busy ? '' : ' disabled') + '>' + esc(t(st.busy ? 'vendorInfo.saving' : 'vendorInfo.save')) + '</button></div>';
  }
  function paint() {
    if (!rootEl || !st) return;
    var main = rootEl.querySelector('.vi-main'), top = main ? main.scrollTop : 0, win = window.pageYOffset || 0;
    rootEl.innerHTML = shell(paintBody());
    bindImg();
    window.scrollTo(0, win); var m2 = rootEl.querySelector('.vi-main'); if (m2) m2.scrollTop = top;
  }
  // Cập nhật nhẹ (không vẽ lại cả trang) khi bấm chip để không mất vị trí cuộn
  function refreshChips() {
    if (!rootEl || !st) return;
    rootEl.querySelectorAll('[data-vi-svc]').forEach(function (b) {
      var on = st.sel.services.indexOf(b.getAttribute('data-vi-svc')) >= 0;
      b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    rootEl.querySelectorAll('[data-vi-area]').forEach(function (b) {
      var on = st.sel.areas.indexOf(b.getAttribute('data-vi-area')) >= 0;
      b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var tool = rootEl.querySelector('[data-vi="toggle-services"]');
    if (tool) tool.textContent = t(st.services.length > 0 && st.sel.services.length === st.services.length ? 'vendorInfo.services.none' : 'vendorInfo.services.all');
    refreshSave();
  }
  function refreshSave() {
    var b = rootEl && rootEl.querySelector('#vi-save');
    if (b) b.disabled = !isDirty() || st.busy;
  }
  function showErr(key, msg) {
    st.errors[key] = msg || '';
    var el = rootEl && rootEl.querySelector('[data-vi-err="' + key + '"]');
    if (key === 'form') el = rootEl && rootEl.querySelector('#vi-error');
    if (el) { el.textContent = msg || ''; el.hidden = !msg; }
  }
  function bindImg() { // ảnh lỗi → chữ cái đầu
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-vi-img]').forEach(function (img) {
      img.addEventListener('error', function () {
        var holder = img.parentNode; if (!holder) return;
        holder.innerHTML = '<span class="avatar-initial">' + esc(initial(st && st.vendor && st.vendor.name)) + '</span>';
      });
    });
  }

  function toggleService(code) {
    var l = st.sel.services, i = l.indexOf(code);
    if (i < 0) l.push(code); else l.splice(i, 1);
    showErr('services', ''); showErr('form', ''); refreshChips();
  }
  function toggleAllServices() {
    var all = st.services.length > 0 && st.sel.services.length === st.services.length;
    st.sel.services = all ? [] : st.services.map(function (s) { return String(s.code || s.id); });
    showErr('services', ''); showErr('form', ''); refreshChips();
  }
  // "Toàn TP.HCM" loại trừ từng quận/huyện (giống form admin 3.3)
  function toggleArea(value) {
    var city = TTV.api.VENDOR_CITY_AREA, l = st.sel.areas, i = l.indexOf(value);
    if (i >= 0) l.splice(i, 1);
    else if (value === city) st.sel.areas = [city];
    else { l.push(value); var ci = l.indexOf(city); if (ci >= 0) l.splice(ci, 1); }
    showErr('areas', ''); showErr('form', ''); refreshChips();
  }
  function pickFile(f) {
    if (!f) return;
    showErr('avatar', '');
    if (!/^image\//.test(f.type)) { showErr('avatar', t('vendorInfo.err.avatarType')); return; }
    if (f.size > MAX_AVATAR_BYTES) { showErr('avatar', t('vendorInfo.err.avatarSize')); return; }
    revokePreview();
    st.file = f; st.removeAvatar = false; st.preview = URL.createObjectURL(f);
    paint();
  }
  function validate() {
    var ok = true, nm = st.form.name.trim().replace(/\s+/g, ' '), ph = st.form.phone.trim();
    if (!nm) { showErr('name', t('vendorInfo.err.nameEmpty')); ok = false; }
    else if (nm.length < 2 || nm.length > 80) { showErr('name', t('vendorInfo.err.nameLen')); ok = false; }
    if (!ph) { showErr('phone', t('vendorInfo.err.phoneEmpty')); ok = false; }
    if (st.form.vehicle.trim().length > 60) { showErr('vehicle', t('vendorInfo.err.vehicleLen')); ok = false; }
    if (!st.sel.services.length) { showErr('services', t('vendorInfo.err.services')); ok = false; }
    if (!st.sel.areas.length) { showErr('areas', t('vendorInfo.err.areas')); ok = false; }
    if (!ok) {
      showErr('form', t('vendorInfo.err.fix'));
      var first = rootEl.querySelector('.vi-err:not([hidden])'); if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return ok;
  }
  function save() {
    if (!st || st.busy || !isDirty()) return;
    showErr('form', ''); showErr('avatar', '');
    if (!validate()) return;
    st.busy = true; refreshSave();
    var btn = rootEl.querySelector('#vi-save'); if (btn) btn.textContent = t('vendorInfo.saving');
    var my = token;
    var up = st.file
      ? TTV.Upload.upload(st.file, { ownerId: st.vendor.id, kind: 'avatar' }).then(function (r) { return r.path; }).catch(function (e) {
          var w = new Error(t('vendorInfo.err.avatarSave', { reason: (e && e.message) || '' })); w.code = 'UPLOAD'; throw w;
        })
      : Promise.resolve(st.removeAvatar ? '' : undefined);
    up.then(function (path) {
      return TTV.api.updateVendorProfile({ avatar_path: path, name: st.form.name, phone: st.form.phone, vehicle: st.form.vehicle, services: st.sel.services.slice(), areas: st.sel.areas.slice() });
    }).then(function () {
      if (my !== token) return;
      revokePreview();
      C.toast(t('vendorInfo.saved'), 'success');
      TTV.Router.navigate('/vendor/profile');
    }).catch(function (err) {
      if (my !== token || !st) return;
      if (err && err.code === 'LOCKED') { TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); }); return; }
      st.busy = false;
      if (err && err.code === 'VALIDATION' && err.errors) {
        st.errors = {};
        if (err.errors.name) st.errors.name = err.errors.name;
        if (err.errors.phone) st.errors.phone = err.errors.phone;
        if (err.errors.vehicle) st.errors.vehicle = err.errors.vehicle;
        if (err.errors.services) st.errors.services = err.errors.services;
        if (err.errors.areas) st.errors.areas = err.errors.areas;
        if (err.errors.avatar_path) st.errors.avatar = err.errors.avatar_path;
        st.errors.form = t('vendorInfo.err.fix');
        paint();
        return;
      }
      st.errors = { form: (err && err.message) || t('vendorInfo.err.save') };
      paint();
    });
  }

  function onClick(e) {
    if (!rootEl || !st) return;
    var svc = e.target.closest('[data-vi-svc]');
    if (svc && rootEl.contains(svc)) { toggleService(svc.getAttribute('data-vi-svc')); return; }
    var area = e.target.closest('[data-vi-area]');
    if (area && rootEl.contains(area)) { toggleArea(area.getAttribute('data-vi-area')); return; }
    var el = e.target.closest('[data-vi]'); if (!el || !rootEl.contains(el)) return;
    var act = el.getAttribute('data-vi');
    if (act === 'toggle-services') toggleAllServices();
    else if (act === 'save') save();
    else if (act === 'remove-avatar') { revokePreview(); st.file = null; st.removeAvatar = true; paint(); }
    else if (act === 'retry') load();
  }
  // Gõ chữ: chỉ ghi vào state + cập nhật nút Lưu (không vẽ lại để không mất con trỏ / bộ gõ tiếng Việt)
  function onInput(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-vi-input]') : null;
    if (!el || !st || !rootEl || !rootEl.contains(el)) return;
    var key = el.getAttribute('data-vi-input');
    st.form[key] = el.value;
    showErr(key, ''); showErr('form', '');
    refreshSave();
  }
  function onChange(e) {
    if (!st || !e.target || e.target.id !== 'vi-file') return;
    var f = e.target.files && e.target.files[0]; e.target.value = '';
    pickFile(f);
  }

  function load() {
    var my = ++token;
    rootEl.innerHTML = shell(C.loading(t('common.loading')));
    Promise.all([TTV.api.getVendorSelf(), TTV.api.listServices()]).then(function (p) {
      if (my !== token || !rootEl) return;
      var v = p[0];
      st = { vendor: v, services: p[1] || [], sel: { services: (v.services || []).map(String), areas: (v.areas || []).map(String) },
        form: formOf(v), file: null, preview: '', removeAvatar: false, errors: {}, busy: false };
      paint();
    }).catch(function (err) {
      if (my !== token || !rootEl) return;
      if (err && err.code === 'LOCKED') { TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); }); return; }
      rootEl.innerHTML = shell('<main class="vo-main">' + C.emptyState(t('vendorInfo.loadError'), (err && err.message) || t('common.error'), { icon: '!' }) +
        '<button type="button" class="btn btn-secondary btn-block" data-vi="retry">' + esc(t('vendorInfo.retry')) + '</button></main>');
    });
  }
  function render() {
    destroy();
    rootEl = app();
    clickHandler = onClick; changeHandler = onChange; inputHandler = onInput;
    rootEl.addEventListener('click', clickHandler); rootEl.addEventListener('change', changeHandler); rootEl.addEventListener('input', inputHandler);
    load();
  }
  function destroy() {
    token++;
    revokePreview(); st = null;
    if (rootEl) {
      if (clickHandler) rootEl.removeEventListener('click', clickHandler);
      if (changeHandler) rootEl.removeEventListener('change', changeHandler);
      if (inputHandler) rootEl.removeEventListener('input', inputHandler);
    }
    rootEl = null; clickHandler = null; changeHandler = null; inputHandler = null;
  }

  TTV.screens.vendorInfo = { render: render, destroy: destroy };
  TTV.Router.add('/vendor/info', render, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: destroy });
})(window.TTV);
