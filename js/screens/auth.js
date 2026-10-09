/* screens/auth.js — Đăng nhập khách: #/login (SĐT +84, Zalo, Google demo) và #/login/otp (task 2.2).
   Bám ảnh docs/reference/01-dang-nhap-1.jpg và 01-dang-nhap-2.jpg. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};

  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function $(root, sel) { return root.querySelector(sel); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  // Timer tự dọn khi màn hình bị thay (phần tử rời khỏi DOM).
  function every(root, ms, fn) {
    var id = setInterval(function () { if (!document.body.contains(root)) { clearInterval(id); return; } fn(); }, ms);
    return id;
  }
  function redirectIfLoggedIn() {
    var s = TTV.auth.getSession();
    if (s && s.role === 'CUSTOMER') { TTV.Router.navigate('/home'); return true; }
    return false;
  }
  function footer() { return '<footer class="auth-footer">© ' + new Date().getFullYear() + ' TingTingVac. All rights reserved.</footer>'; }
  function brand() { return '<h1 class="auth-brand"><span>TINGTING</span> <em>VAC</em></h1>'; }

  /* ===== #/login ===== */
  function renderLogin() {
    if (redirectIfLoggedIn()) return;
    var root = app();
    root.innerHTML = '<main class="auth-page"><section class="auth-card">' +
      '<div class="auth-hero" aria-hidden="true"><span class="auth-hero__sparkle">✦</span><span class="auth-hero__main">🛋️</span><span class="auth-hero__side">📦</span><span class="auth-hero__person">🧑‍🔧</span></div>' +
      '<div class="auth-body">' +
      '<p class="auth-welcome">Chào mừng đến</p>' + brand() +
      '<p class="auth-sub">Đăng nhập để tạo đơn bốc vác, theo dõi thợ và quản lý ví đơn hàng của bạn.</p>' +
      '<form id="login-form" novalidate>' +
      '<div class="phone-row">' +
      '<div class="phone-cc" title="Hiện chỉ hỗ trợ số điện thoại Việt Nam"><span aria-hidden="true">🇻🇳</span><b>+84</b><i aria-hidden="true">⌄</i></div>' +
      '<label class="phone-input"><span aria-hidden="true">📞</span><input id="login-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="Số điện thoại" maxlength="16" aria-label="Số điện thoại"></label>' +
      '</div>' +
      '<p class="field-error" id="login-error" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary btn-block" id="login-submit" disabled>Gửi mã OTP</button>' +
      '</form>' +
      '<div class="auth-divider"><span>Hoặc</span></div>' +
      '<button type="button" class="btn-social" data-social="zalo"><span class="social-zalo" aria-hidden="true">Zalo</span>Đăng nhập với Zalo</button>' +
      '<button type="button" class="btn-social" data-social="google"><span class="social-google" aria-hidden="true"><b>G</b></span>Đăng nhập với Google</button>' +
      '</div></section>' + footer() + '<p class="auth-staff-link"><button type="button" class="link-btn" data-route="/staff-login">Dành cho thợ &amp; nhân viên</button></p></main>';

    var form = $(root, '#login-form'), input = $(root, '#login-phone'), submit = $(root, '#login-submit'), err = $(root, '#login-error');
    var busy = false;
    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function refresh() {
      input.value = input.value.replace(/[^0-9+\s.\-]/g, '');
      var ok = TTV.api.normalizePhone(input.value).ok;
      submit.disabled = !ok || busy;
      // Số nước ngoài (+1…) báo lỗi ngay, không chờ bấm nút.
      var v = input.value.replace(/\s/g, '');
      if (v.charAt(0) === '+' && v.length >= 3 && v.indexOf('+84') !== 0) showError('Hiện chỉ hỗ trợ số điện thoại Việt Nam (+84).'); else showError('');
    }
    input.addEventListener('input', refresh);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || submit.disabled) return;
      busy = true; submit.disabled = true; submit.textContent = 'Đang gửi…'; showError('');
      TTV.api.requestOtp(input.value).then(function (r) {
        C.toast('Mã OTP demo: ' + r.code, 'success');
        TTV.Router.navigate('/login/otp');
      }).catch(function (e2) {
        busy = false; submit.textContent = 'Gửi mã OTP'; refresh();
        showError(e2.code === 'LOCKED' ? 'Số này đang bị khóa tạm do nhập sai OTP. Thử lại sau ' + mmss(e2.locked_until - Date.now()) + '.' : e2.message);
      });
    });
    root.querySelectorAll('[data-social]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        busy = true; btn.disabled = true;
        var method = btn.getAttribute('data-social');
        TTV.api.loginDemo(method).then(function (r) {
          C.toast('Đã đăng nhập bằng tài khoản ' + (method === 'zalo' ? 'Zalo' : 'Google') + ' demo.', 'success');
          TTV.Router.navigate(r.next);
        }).catch(function (e2) { busy = false; btn.disabled = false; C.toast(e2.message || 'Đăng nhập thất bại.', 'error'); });
      });
    });
    input.focus();
  }

  /* ===== #/login/otp ===== */
  function renderOtp() {
    if (redirectIfLoggedIn()) return;
    var root = app();
    root.innerHTML = '<main class="auth-page">' + C.loading('Đang tải…') + '</main>';
    TTV.api.getOtpState().then(function (state) {
      if (!state) { TTV.Router.navigate('/login'); return; }
      drawOtp(root, state);
    }).catch(function (e) { root.innerHTML = '<main class="auth-page">' + C.emptyState('Không tải được màn xác thực', e.message || 'Hãy thử lại.', { label: 'Về đăng nhập', action: '' }) + '</main>'; });
  }

  function drawOtp(root, state) {
    var max = state.max_attempts, attemptsLeft = state.attempts_left, lockedUntil = state.locked_until, resendAt = state.resend_at, busy = false;
    root.innerHTML = '<main class="auth-page"><section class="auth-card">' +
      '<div class="auth-hero auth-hero--otp" aria-hidden="true"><span class="auth-hero__sparkle">✦</span><span class="auth-hero__main">🔐</span><span class="auth-hero__side">📦</span><span class="auth-hero__person">🧑‍🔧</span></div>' +
      '<div class="auth-body">' +
      '<p class="auth-welcome auth-welcome--dark">Xác thực OTP</p><h1 class="auth-title">Nhập mã OTP</h1>' +
      '<p class="auth-sub">Mã OTP đã được gửi để xác minh tài khoản của bạn.</p>' +
      '<button type="button" class="auth-back" id="otp-back"><span aria-hidden="true">←</span> Quay lại</button>' +
      '<div class="otp-sent"><span>Mã OTP đã được gửi đến</span><div><b>' + esc(state.masked) + '</b><button type="button" class="link-btn" id="otp-change">Đổi số</button></div></div>' +
      '<form id="otp-form" novalidate><p class="otp-label">Nhập mã OTP 6 chữ số</p>' +
      '<div class="otp-boxes" id="otp-boxes"><input class="otp-input" id="otp-input" type="text" inputmode="numeric" autocomplete="one-time-code" aria-label="Mã OTP 6 chữ số" spellcheck="false" autocapitalize="off">' + [0, 1, 2, 3, 4, 5].map(function () { return '<span class="otp-box" aria-hidden="true"></span>'; }).join('') + '</div>' +
      '<p class="field-error otp-error" id="otp-error" role="alert" hidden></p>' +
      '<p class="otp-attempts" id="otp-attempts"></p>' +
      '<button type="submit" class="btn btn-primary btn-block" id="otp-submit" disabled>Xác nhận đăng nhập</button></form>' +
      '<p class="otp-resend" id="otp-resend"></p>' +
      '<div class="otp-demo-hint">Mã OTP demo: <b>' + esc(state.code) + '</b></div>' +
      '</div></section>' + footer() + '</main>';

    var boxes = Array.prototype.slice.call(root.querySelectorAll('.otp-box')), input = $(root, '#otp-input'), submit = $(root, '#otp-submit'), err = $(root, '#otp-error'),
      attemptsEl = $(root, '#otp-attempts'), resendEl = $(root, '#otp-resend'), form = $(root, '#otp-form');

    function code() { return input.value; }
    // Vẽ lại 6 ô từ giá trị của <input> duy nhất; ô đang chờ nhập được tô sáng.
    function paintBoxes() {
      var v = input.value, focused = document.activeElement === input && !input.disabled;
      boxes.forEach(function (b, i) {
        b.textContent = v.charAt(i);
        b.classList.toggle('is-filled', i < v.length);
        b.classList.toggle('is-active', focused && i === Math.min(v.length, boxes.length - 1));
        b.classList.toggle('is-disabled', input.disabled);
      });
    }
    function setCode(v) { input.value = v; paintBoxes(); }
    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function isLocked() { return lockedUntil > Date.now(); }
    function paintAttempts() {
      attemptsEl.innerHTML = 'Số lần thử còn lại: <b>' + attemptsLeft + '/' + max + '</b>';
      attemptsEl.classList.toggle('is-low', attemptsLeft <= 2);
    }
    function refreshSubmit() { submit.disabled = busy || isLocked() || code().length !== 6; }
    function paintResend() {
      if (isLocked()) { resendEl.innerHTML = ''; return; }
      var wait = resendAt - Date.now();
      if (wait > 0) resendEl.innerHTML = 'Gửi lại mã sau <b>' + Math.ceil(wait / 1000) + 's</b>';
      else resendEl.innerHTML = '<button type="button" class="link-btn" id="otp-resend-btn">Gửi lại mã</button>';
    }
    function paintLock() {
      if (isLocked()) {
        input.disabled = true; setCode('');
        showError('Bạn đã nhập sai ' + max + ' lần. Vui lòng thử lại sau ' + mmss(lockedUntil - Date.now()) + '.');
        attemptsEl.textContent = 'Tài khoản tạm thời bị khóa nhận OTP.';
        attemptsEl.classList.add('is-low');
      } else if (input.disabled) {
        // Hết khóa: quay về nhập lại số để lấy mã mới.
        TTV.api.cancelOtp(); TTV.Router.navigate('/login'); return;
      }
      refreshSubmit();
    }
    function shake() { var wrap = $(root, '#otp-boxes'); wrap.classList.remove('is-shaking'); void wrap.offsetWidth; wrap.classList.add('is-shaking'); }

    // Chỉ MỘT <input> thật nhận ký tự; mỗi lần chỉ lọc lại TOÀN BỘ giá trị thành tối đa 6 chữ số.
    // Cách này không cộng dồn nên không lỗi khi gõ bằng bộ gõ tiếng Việt (Telex/VNI) của Windows,
    // vốn gửi chuỗi đang soạn tích lũy ("1", "12", "123") qua nhiều sự kiện input.
    function sanitize() {
      var clean = input.value.replace(/\D/g, '').slice(0, 6);
      if (clean !== input.value) input.value = clean; // chỉ ghi khi khác, để không ngắt phiên soạn của IME
      showError(''); paintBoxes(); refreshSubmit();
    }
    input.addEventListener('input', sanitize);
    input.addEventListener('compositionend', sanitize);
    input.addEventListener('focus', paintBoxes);
    input.addEventListener('blur', paintBoxes);
    $(root, '#otp-boxes').addEventListener('click', function () { if (!input.disabled) input.focus(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      busy = true; submit.disabled = true; submit.textContent = 'Đang xác nhận…'; showError('');
      TTV.api.verifyOtp(code()).then(function (r) {
        C.toast('Đăng nhập thành công.', 'success');
        TTV.Router.navigate(r.next);
      }).catch(function (e2) {
        busy = false; submit.textContent = 'Xác nhận đăng nhập';
        if (e2.code === 'WRONG_CODE') {
          attemptsLeft = e2.attempts_left; paintAttempts(); showError('Mã OTP không đúng. Vui lòng thử lại.');
          setCode(''); input.focus(); shake();
        } else if (e2.code === 'LOCKED') {
          lockedUntil = e2.locked_until; attemptsLeft = 0; paintAttempts(); paintLock();
        } else if (e2.code === 'EXPIRED') {
          showError(e2.message); setCode('');
        } else if (e2.code === 'NO_CHALLENGE') {
          C.toast(e2.message, 'error'); TTV.Router.navigate('/login'); return;
        } else showError(e2.message);
        refreshSubmit();
      });
    });

    function leave() { TTV.api.cancelOtp(); TTV.Router.navigate('/login'); }
    $(root, '#otp-back').addEventListener('click', leave);
    $(root, '#otp-change').addEventListener('click', leave);
    resendEl.addEventListener('click', function (e) {
      if (!e.target.closest('#otp-resend-btn')) return;
      TTV.api.resendOtp().then(function (r) {
        return TTV.api.getOtpState().then(function (s) {
          resendAt = s.resend_at; paintResend();
          C.toast('Đã gửi lại mã. Mã OTP demo: ' + r.code, 'success');
          setCode(''); input.focus(); showError(''); refreshSubmit();
        });
      }).catch(function (e2) {
        if (e2.code === 'LOCKED') { lockedUntil = e2.locked_until; paintLock(); } else C.toast(e2.message, 'error');
      });
    });

    paintAttempts(); paintResend(); paintLock();
    if (!isLocked()) input.focus();
    every(root, 1000, function () {
      paintResend();
      if (lockedUntil) { if (isLocked()) { showError('Bạn đã nhập sai ' + max + ' lần. Vui lòng thử lại sau ' + mmss(lockedUntil - Date.now()) + '.'); } else paintLock(); }
    });
  }

  TTV.screens.auth = { renderLogin: renderLogin, renderOtp: renderOtp };
  TTV.Router.add('/login', renderLogin);
  TTV.Router.add('/login/otp', renderOtp);

  /* ===== #/onboarding (task 2.3) — bám docs/reference/02-hoan-tat-thong-tin-*.jpg ===== */
  function localPhone(e164) { e164 = String(e164 || ''); return e164.indexOf('+84') === 0 ? '0' + e164.slice(3) : e164; }
  var METHOD_LABEL = { zalo: 'Zalo', google: 'Google' };
  function policyLinks(withStar) {
    return '<button type="button" class="link-btn" data-policy="terms">Điều khoản sử dụng</button> và <button type="button" class="link-btn" data-policy="privacy">Chính sách bảo mật</button>' + (withStar ? ' <span class="req">*</span>' : '');
  }
  function openPolicy(type) {
    // Tạm hiện nội dung trong bottom sheet (giữ nguyên dữ liệu đang nhập); màn #/policies làm ở task 9.5.
    TTV.api.getPolicy(type).then(function (p) {
      var title = p ? p.title : (type === 'terms' ? 'Điều khoản sử dụng' : 'Chính sách bảo mật');
      var body = p ? '<p>' + esc(p.content) + '</p><p class="muted">Cập nhật lần cuối: ' + esc(TTV.Utils.date(p.updated_at)) + '</p>' : '<p class="muted">Chưa có nội dung.</p>';
      document.body.insertAdjacentHTML('beforeend', C.sheet(title, body, { footer: '<button type="button" class="btn btn-primary" data-sheet-close>Đã hiểu</button>' }));
    });
  }

  function renderOnboarding() {
    var root = app(), s = TTV.auth.getSession();
    if (!s || s.role !== 'CUSTOMER') { TTV.Router.navigate('/login'); return; }
    root.innerHTML = '<main class="auth-page">' + C.loading('Đang tải…') + '</main>';
    TTV.api.getCurrentUser().then(function (user) {
      if (!user) { TTV.api.logout().then(function () { TTV.Router.navigate('/login'); }); return; }
      if (!TTV.api.needsOnboarding(user)) { TTV.Router.navigate('/home'); return; } // đã có hồ sơ thì không vào lại
      drawOnboarding(root, user);
    }).catch(function (e) { root.innerHTML = '<main class="auth-page">' + C.emptyState('Không tải được hồ sơ', e.message || 'Hãy thử lại.') + '</main>'; });
  }

  function drawOnboarding(root, user) {
    var verified = user.phone ? localPhone(user.phone) : 'Tài khoản ' + (METHOD_LABEL[user.login_method] || 'demo') + ' (demo)';
    root.innerHTML = '<main class="auth-page"><section class="auth-card">' +
      '<div class="auth-hero" aria-hidden="true"><span class="auth-hero__sparkle">✦</span><span class="auth-hero__main">🪪</span><span class="auth-hero__side">📦</span><span class="auth-hero__person">🧑‍🔧</span></div>' +
      '<div class="auth-body auth-body--left">' +
      '<div class="auth-center"><p class="auth-welcome auth-welcome--dark">Hoàn tất thông tin</p><h1 class="auth-title auth-title--brand">TingTingVac</h1>' +
      '<p class="auth-sub">Điền thông tin cá nhân để bắt đầu sử dụng TingTingVac.</p></div>' +
      '<button type="button" class="auth-back" id="ob-back"><span aria-hidden="true">←</span> Quay lại</button>' +
      '<div class="verified-card"><div><span class="verified-card__label">Số điện thoại đã xác thực</span><b><span aria-hidden="true">📱</span> ' + esc(verified) + '</b></div><span class="verified-card__tick" aria-hidden="true">✓</span></div>' +
      '<form id="ob-form" novalidate>' +
      '<label class="field field--icon"><span class="field__label field__label--caps">Họ và tên <b>*</b></span><span class="field__wrap"><span aria-hidden="true">👤</span><input id="ob-name" name="name" type="text" autocomplete="name" placeholder="Nhập họ và tên" maxlength="80"></span></label>' +
      '<label class="field field--icon"><span class="field__label field__label--caps">Email <b>*</b></span><span class="field__wrap"><span aria-hidden="true">✉️</span><input id="ob-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="email@example.com" maxlength="120"></span></label>' +
      '<p class="field-error field-error--reserved" id="ob-email-error">Email không hợp lệ.</p>' +
      '<label class="check-row"><input type="checkbox" id="ob-terms"><span>Tôi đồng ý với ' + policyLinks(true) + '</span></label>' +
      '<div class="lock-note"><span aria-hidden="true">🔒</span><span>Thông tin của bạn được bảo mật và chỉ dùng để liên hệ khi có đơn hàng.</span></div>' +
      '<p class="field-error" id="ob-error" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary btn-block" id="ob-submit" disabled>Hoàn tất</button></form>' +
      '<div class="otp-demo-hint otp-demo-hint--left"><span aria-hidden="true">✔</span> Xác thực thành công! Vui lòng hoàn tất thông tin.</div>' +
      '</div></section><footer class="auth-footer">© ' + new Date().getFullYear() + ' TingTingVac. All rights reserved.<div class="auth-footer__links">' +
      '<button type="button" class="link-btn" data-policy="terms">Điều khoản sử dụng</button><i></i><button type="button" class="link-btn" data-policy="privacy">Chính sách bảo mật</button></div></footer></main>';

    var name = $(root, '#ob-name'), email = $(root, '#ob-email'), terms = $(root, '#ob-terms'), submit = $(root, '#ob-submit'),
      err = $(root, '#ob-error'), emailErr = $(root, '#ob-email-error'), form = $(root, '#ob-form'), busy = false;
    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function refresh() {
      var nameOk = name.value.trim().length >= 2, emailFilled = email.value.trim().length > 0, emailOk = TTV.api.isValidEmail(email.value);
      emailErr.style.visibility = (!emailFilled || emailOk || document.activeElement === email) ? 'hidden' : 'visible'; // chỉ báo lỗi khi rời ô; luôn giữ chỗ để bố cục không nhảy
      submit.disabled = busy || !(nameOk && emailOk && terms.checked);
    }
    [name, email].forEach(function (el) { el.addEventListener('input', function () { showError(''); refresh(); }); el.addEventListener('blur', refresh); });
    terms.addEventListener('change', function () { showError(''); refresh(); });
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-policy]'); if (b) { e.preventDefault(); openPolicy(b.getAttribute('data-policy')); } });
    $(root, '#ob-back').addEventListener('click', function () { TTV.api.logout().then(function () { TTV.Router.navigate('/login'); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      busy = true; submit.disabled = true; submit.textContent = 'Đang lưu…'; showError('');
      TTV.api.completeOnboarding({ name: name.value, email: email.value, accepted_terms: terms.checked }).then(function () {
        C.toast('Chào mừng bạn đến với TingTingVac!', 'success');
        TTV.Router.navigate('/home');
      }).catch(function (e2) { busy = false; submit.textContent = 'Hoàn tất'; refresh(); showError(e2.message || 'Không lưu được thông tin.'); });
    });
    name.focus();
  }

  TTV.screens.auth.renderOnboarding = renderOnboarding;
  TTV.Router.add('/onboarding', renderOnboarding);

  /* ===== Màn tạm cho đến khi làm task 4.1 (để đăng nhập xong không rơi vào 404) ===== */
  TTV.Router.add('/home', function () {
    var root = app(), s = TTV.auth.getSession();
    if (!s || s.role !== 'CUSTOMER') { TTV.Router.navigate('/login'); return; }
    TTV.api.getCurrentUser().then(function (u) {
      if (TTV.api.needsOnboarding(u)) { TTV.Router.navigate('/onboarding'); return; }
      root.innerHTML = C.header('Trang chủ', { back: false }) + '<main class="page">' +
        C.card('<p>Xin chào <b>' + esc(u.name) + '</b> (' + esc(u.email) + ').</p><p class="muted">Màn tạm — làm ở task 4.1.</p>' +
          '<button class="btn btn-secondary btn-block" id="tmp-logout">Đăng xuất</button>', { title: 'Phiên khách' }) + '</main>';
      $(root, '#tmp-logout').addEventListener('click', function () { TTV.api.logout().then(function () { TTV.Router.navigate('/login'); }); });
    });
  });
})(window.TTV);
