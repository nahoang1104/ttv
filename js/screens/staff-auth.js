/* screens/staff-auth.js — Đăng nhập thợ/staff: #/staff-login, ép đổi mật khẩu lần đầu: #/change-password (task 2.4).
   Khu thợ và admin tự thiết kế (không có ảnh Excel), dùng chung phong cách thị giác với màn đăng nhập khách. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};

  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function $(root, sel) { return root.querySelector(sel); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function staffSession() { var s = TTV.auth.getSession(); return s && TTV.api.isStaffSide(s.role) ? s : null; }
  function footer() { return '<footer class="auth-footer">© ' + new Date().getFullYear() + ' TingTingVac. All rights reserved.</footer>'; }

  // Ô mật khẩu có nút hiện/ẩn.
  function passwordField(id, label, autocomplete, placeholder) {
    return '<label class="field field--icon"><span class="field__label field__label--caps">' + esc(label) + '</span><span class="field__wrap"><span aria-hidden="true">🔑</span>' +
      '<input id="' + id + '" type="password" autocomplete="' + autocomplete + '" placeholder="' + esc(placeholder || '') + '" maxlength="64">' +
      '<button type="button" class="field__eye" data-eye="' + id + '" aria-label="Hiện mật khẩu">👁</button></span></label>';
  }
  function bindEyes(root) {
    root.querySelectorAll('[data-eye]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = root.querySelector('#' + btn.getAttribute('data-eye')), show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); btn.classList.toggle('is-on', show);
      });
    });
  }

  /* ===== #/staff-login ===== */
  function renderStaffLogin() {
    var existing = staffSession();
    if (existing) { TTV.Router.navigate(existing.must_change_pw ? '/change-password' : TTV.api.homeRouteFor(existing.role)); return; }
    var root = app();
    root.innerHTML = '<main class="auth-page"><section class="auth-card">' +
      '<div class="auth-hero auth-hero--staff" aria-hidden="true"><span class="auth-hero__sparkle">✦</span><span class="auth-hero__main">🛠️</span><span class="auth-hero__person">🧑‍💼</span></div>' +
      '<div class="auth-body auth-body--left"><div class="auth-center"><p class="auth-welcome auth-welcome--dark">Đăng nhập</p><h1 class="auth-title">Thợ &amp; Nhân viên</h1>' +
      '<p class="auth-sub">Dùng tài khoản do quản trị viên cấp để vào khu quản lý.</p></div>' +
      '<form id="staff-form" novalidate>' +
      '<label class="field field--icon"><span class="field__label field__label--caps">Tên đăng nhập</span><span class="field__wrap"><span aria-hidden="true">👤</span><input id="staff-user" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Nhập tên đăng nhập" maxlength="40"></span></label>' +
      passwordField('staff-pass', 'Mật khẩu', 'current-password', 'Nhập mật khẩu') +
      '<p class="field-error" id="staff-error" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary btn-block" id="staff-submit" disabled>Đăng nhập</button></form>' +
      '<p class="auth-staff-link"><button type="button" class="link-btn" data-route="/login">← Đăng nhập khách hàng</button></p>' +
      '</div></section>' + footer() + '</main>';

    var user = $(root, '#staff-user'), pass = $(root, '#staff-pass'), submit = $(root, '#staff-submit'), err = $(root, '#staff-error'), form = $(root, '#staff-form'), busy = false, lockTimer = null;
    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function refresh() { submit.disabled = busy || !user.value.trim() || !pass.value; }
    [user, pass].forEach(function (el) { el.addEventListener('input', function () { if (!lockTimer) showError(''); refresh(); }); });
    bindEyes(root);
    function startLock(until) {
      clearInterval(lockTimer);
      lockTimer = setInterval(function () {
        if (!document.body.contains(root)) { clearInterval(lockTimer); return; }
        var left = until - Date.now();
        if (left <= 0) { clearInterval(lockTimer); lockTimer = null; showError(''); refresh(); return; }
        showError('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ' + mmss(left) + '.'); submit.disabled = true;
      }, 500);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      busy = true; submit.disabled = true; submit.textContent = 'Đang đăng nhập…'; showError('');
      TTV.api.loginStaff(user.value, pass.value).then(function (r) {
        C.toast(r.must_change_pw ? 'Đăng nhập thành công. Vui lòng đổi mật khẩu lần đầu.' : 'Đăng nhập thành công.', 'success');
        TTV.Router.navigate(r.next);
      }).catch(function (e2) {
        busy = false; submit.textContent = 'Đăng nhập'; pass.value = ''; refresh();
        if (e2.code === 'LOCKED') { showError('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ' + mmss(e2.locked_until - Date.now()) + '.'); startLock(e2.locked_until); submit.disabled = true; }
        else if (e2.code === 'BAD_CREDENTIALS') showError(e2.message + (e2.attempts_left <= 2 ? ' Còn ' + e2.attempts_left + ' lần thử.' : ''));
        else showError(e2.message || 'Đăng nhập thất bại.');
        pass.focus();
      });
    });
    user.focus();
  }

  /* ===== #/change-password (ép đổi lần đầu) ===== */
  function renderChangePassword() {
    var s = staffSession();
    if (!s) { TTV.Router.navigate('/staff-login'); return; }
    var root = app(), forced = !!s.must_change_pw;
    root.innerHTML = '<main class="auth-page"><section class="auth-card">' +
      '<div class="auth-hero auth-hero--staff" aria-hidden="true"><span class="auth-hero__sparkle">✦</span><span class="auth-hero__main">🔐</span></div>' +
      '<div class="auth-body auth-body--left"><div class="auth-center"><p class="auth-welcome auth-welcome--dark">' + (forced ? 'Đổi mật khẩu lần đầu' : 'Đổi mật khẩu') + '</p><h1 class="auth-title">Mật khẩu mới</h1>' +
      '<p class="auth-sub">' + (forced ? 'Vì lý do bảo mật, bạn cần đặt mật khẩu mới trước khi sử dụng.' : 'Đặt mật khẩu mới cho tài khoản của bạn.') + '</p></div>' +
      '<form id="pw-form" novalidate>' +
      passwordField('pw-new', 'Mật khẩu mới', 'new-password', 'Ít nhất 8 ký tự, có chữ và số') +
      passwordField('pw-confirm', 'Nhập lại mật khẩu mới', 'new-password', 'Nhập lại mật khẩu') +
      '<ul class="pw-rules" id="pw-rules"><li data-rule="len">Ít nhất 8 ký tự</li><li data-rule="mix">Có cả chữ và số</li><li data-rule="match">Hai mật khẩu khớp nhau</li></ul>' +
      '<p class="field-error" id="pw-error" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary btn-block" id="pw-submit" disabled>Lưu mật khẩu</button></form>' +
      '<p class="auth-staff-link"><button type="button" class="link-btn" id="pw-logout">Đăng xuất</button></p>' +
      '</div></section>' + footer() + '</main>';

    var nw = $(root, '#pw-new'), cf = $(root, '#pw-confirm'), submit = $(root, '#pw-submit'), err = $(root, '#pw-error'), form = $(root, '#pw-form'), busy = false;
    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function refresh() {
      var v = nw.value, rules = { len: v.length >= 8, mix: /[A-Za-z]/.test(v) && /\d/.test(v), match: v.length > 0 && v === cf.value };
      Object.keys(rules).forEach(function (k) { $(root, '[data-rule="' + k + '"]').classList.toggle('is-ok', rules[k]); });
      submit.disabled = busy || !(rules.len && rules.mix && rules.match);
    }
    [nw, cf].forEach(function (el) { el.addEventListener('input', function () { showError(''); refresh(); }); });
    bindEyes(root);
    $(root, '#pw-logout').addEventListener('click', function () { TTV.api.logout().then(function () { TTV.Router.navigate('/staff-login'); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      busy = true; submit.disabled = true; submit.textContent = 'Đang lưu…'; showError('');
      TTV.api.changePassword(nw.value, cf.value).then(function (r) {
        C.toast('Đã đổi mật khẩu.', 'success');
        TTV.Router.navigate(r.next);
      }).catch(function (e2) { busy = false; submit.textContent = 'Lưu mật khẩu'; refresh(); showError(e2.message || 'Không đổi được mật khẩu.'); });
    });
    nw.focus();
  }

  /* ===== Màn tạm cho tới task 3.1 (admin) và 5.1 (thợ); guard đầy đủ làm ở 2.5 ===== */
  function placeholder(title, note) {
    return function () {
      var root = app(), s = staffSession();
      if (!s) { TTV.Router.navigate('/staff-login'); return; }
      if (s.must_change_pw) { TTV.Router.navigate('/change-password'); return; }
      root.innerHTML = C.header(title, { back: false }) + '<main class="page">' +
        C.card('<p>Đã đăng nhập: <b>' + esc(s.name || s.account_id) + '</b></p><p>Vai trò: <b>' + esc(s.role) + '</b></p><p class="muted">' + esc(note) + '</p>' +
          '<button class="btn btn-secondary btn-block" id="tmp-logout">Đăng xuất</button>', { title: 'Phiên đăng nhập' }) + '</main>';
      $(root, '#tmp-logout').addEventListener('click', function () { TTV.api.logout().then(function () { TTV.Router.navigate('/staff-login'); }); });
    };
  }
  var staffRoute = { roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'], loginRoute: '/staff-login', deniedRoute: '/staff-login' };
  var vendorRoute = { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login' };

  TTV.screens.staffAuth = { renderStaffLogin: renderStaffLogin, renderChangePassword: renderChangePassword };
  TTV.Router.add('/staff-login', renderStaffLogin);
  TTV.Router.add('/change-password', renderChangePassword);
  TTV.Router.add('/admin', placeholder('Quản trị', 'Màn tạm — khung admin làm ở task 3.1.'), staffRoute);
  TTV.Router.add('/vendor', placeholder('Khu thợ', 'Màn tạm — khung app thợ làm ở task 5.1.'), vendorRoute);
})(window.TTV);
