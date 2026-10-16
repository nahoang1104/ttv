/* screens/profile.js — Cá nhân (#/profile) và Thông tin cá nhân (#/profile/info) cho khách (task 2.6).
   Bám ảnh docs/reference/16-ca-nhan-1.jpg, 16-ca-nhan-2.jpg và 18-thong-tin-ca-nhan-1.jpg. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  var APP_VERSION = '1.0.0';
  var MAX_AVATAR_BYTES = 10 * 1024 * 1024; // chỉ chặn file quá lớn; ảnh vẫn lưu nguyên bản, không nén

  function t(key, params) { return TTV.I18n.t(key, params); }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function $(root, sel) { return root.querySelector(sel); }

  /* ===== Icon (SVG nội tuyến, nét xanh như ảnh gốc) ===== */
  function svg(inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; }
  var ICONS = {
    user: svg('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5"/>'),
    pin: svg('<path d="M12 21s6.5-6.1 6.5-11.2A6.5 6.5 0 0 0 5.5 9.8C5.5 14.9 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>'),
    card: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2.4"/><path d="M3.5 10h17"/>'),
    ticket: svg('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.7a1.8 1.8 0 0 0 0 3.6v1.7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-1.7a1.8 1.8 0 0 0 0-3.6z"/><path d="M9.5 10h5M9.5 14h5"/>'),
    star: svg('<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.3L12 16l-4.8 2.7 1-5.3-4-3.7 5.4-.7z"/>'),
    bell: svg('<path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.4 1.5H5.1z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
    shield: svg('<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.3 7 9 4.1-1.7 7-4.8 7-9V6z"/>'),
    alert: svg('<path d="M12 4.5 3.5 19h17z"/><path d="M12 10v4M12 16.6v.1"/>'),
    help: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1 .8-1 1.5M12 16.6v.1"/>'),
    doc: svg('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>'),
    logout: svg('<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"/><path d="M14 8l4 4-4 4M18 12H9.5"/>'),
    chevron: svg('<path d="m9.5 6 6 6-6 6"/>'),
    edit: svg('<path d="M4.5 19.5l1-4L16 5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.5 18.5z"/><path d="m14.5 6.5 3 3"/>'),
    lock: svg('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    save: svg('<path d="M5.5 4.5h10l3 3v11a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/><path d="M8.5 4.5v4h6v-4M8.5 19.5v-5h7v5"/>')
  };

  /* ===== Dữ liệu hiển thị ===== */
  // Mục menu. Route đã được đăng ký (kể cả màn tạm) thì mở được; chưa có thì hiện "Sắp có" và tự mở khi task sau thêm route.
  var SECTIONS = [
    { title: 'profile.section.account', items: [
      { icon: 'user', label: 'profile.menu.info', route: '/profile/info' },
      { icon: 'pin', label: 'profile.menu.addresses', route: '/address' },
      { icon: 'card', label: 'profile.menu.payment', route: '/payment-methods' },
      { icon: 'ticket', label: 'profile.menu.coupons', route: '/coupons' },
      { icon: 'star', label: 'profile.menu.reviews', route: '/reviews' }
    ] },
    { title: 'profile.section.support', items: [
      { icon: 'bell', label: 'profile.menu.notifications', route: '/settings/notifications' },
      { icon: 'shield', label: 'profile.menu.security', route: '/security' },
      { icon: 'alert', label: 'profile.menu.reports', route: '/reports' },
      { icon: 'help', label: 'profile.menu.help', route: '/help' },
      { icon: 'doc', label: 'profile.menu.policies', route: '/policies' },
      { icon: 'gear', label: 'profile.menu.settings', route: '/settings' }
    ] }
  ];

  function localPhone(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.indexOf('84') === 0 && d.length === 11) d = '0' + d.slice(2);
    return d;
  }
  // "0358 *** 915": che 3 số giữa của số 10 chữ số (ảnh gốc).
  function displayPhone(user) {
    var d = localPhone(user && user.phone);
    if (!d) return t('profile.phone.demo', { method: user && user.login_method === 'zalo' ? 'Zalo' : user && user.login_method === 'google' ? 'Google' : 'demo' });
    if (d.length === 10) return d.slice(0, 4) + ' *** ' + d.slice(-3);
    return TTV.Utils.maskPhone(d);
  }
  function kycOf(user) {
    var key = user && TTV.api.KYC_LABELS[user.kyc_status] ? user.kyc_status : 'none';
    return { key: key, label: TTV.api.KYC_LABELS[key] };
  }
  function initial(name) { return (String(name || '').trim().charAt(0) || '?').toUpperCase(); }
  function avatarInner(name, src) {
    return src ? '<img src="' + esc(src) + '" alt="" data-avatar-img>' : '<span class="avatar-initial">' + esc(initial(name)) + '</span>';
  }
  // Ảnh lỗi/không tải được (đường dẫn hỏng, file bị xóa): quay về chữ cái đầu của tên.
  function bindAvatarFallback(root, name) {
    root.querySelectorAll('[data-avatar-img]').forEach(function (img) {
      img.addEventListener('error', function () {
        var holder = img.parentNode;
        if (holder) holder.innerHTML = '<span class="avatar-initial">' + esc(initial(name)) + '</span>';
      }, { once: true });
    });
  }

  /* ===================== #/profile ===================== */
  var docHandler = null;
  var stopUnread = null;

  function menuRow(item) {
    var ready = TTV.Router.has(item.route);
    return '<button type="button" class="menu-row' + (ready ? '' : ' is-soon') + '" data-menu-route="' + esc(item.route) + '">' +
      '<span class="menu-row__icon">' + ICONS[item.icon] + '</span>' +
      '<span class="menu-row__label">' + esc(t(item.label)) + '</span>' +
      (ready ? '' : '<span class="menu-row__soon">' + esc(t('common.comingSoon')) + '</span>') +
      '<span class="menu-row__chev">' + ICONS.chevron + '</span></button>';
  }

  function profileMarkup(user, stats, unread) {
    var kyc = kycOf(user);
    return '<div class="profile">' +
      '<header class="profile-hero">' +
        '<div class="profile-hero__actions">' +
          '<button type="button" class="profile-hero__btn" data-route="/notifications" aria-label="' + esc(t('profile.menu.notifications') + (unread > 0 ? ' (' + unread + ')' : '')) + '">' + ICONS.bell + TTV.Utils.unreadBadge(unread) + '</button>' +
          '<button type="button" class="profile-hero__btn" data-menu-route="/settings" aria-label="' + esc(t('profile.menu.settings')) + '">' + ICONS.gear + '</button>' +
        '</div>' +
        '<div class="profile-hero__user">' +
          '<div class="profile-avatar"><span class="profile-avatar__img">' + avatarInner(user.name, user.avatar_path) + '</span>' +
            '<button type="button" class="profile-avatar__edit" data-route="/profile/info" aria-label="' + esc(t('profile.edit')) + '">' + ICONS.edit + '</button></div>' +
          '<div class="profile-hero__text"><h1>' + esc(user.name || t('profile.noName')) + '</h1><p>' + esc(displayPhone(user)) + '</p>' +
            '<span class="kyc-badge kyc-badge--' + kyc.key + '"><i></i>' + esc(kyc.label) + '</span></div>' +
        '</div>' +
      '</header>' +
      '<section class="profile-stats" aria-label="' + esc(t('profile.stats')) + '">' +
        '<div><b>' + stats.completed + '</b><span>' + esc(t('profile.stats.completed')) + '</span></div>' +
        '<div><b>' + stats.processing + '</b><span>' + esc(t('profile.stats.processing')) + '</span></div>' +
      '</section>' +
      SECTIONS.map(function (sec) {
        return '<h2 class="profile-section">' + esc(t(sec.title)) + '</h2><div class="menu-card">' + sec.items.map(menuRow).join('') + '</div>';
      }).join('') +
      '<p class="profile-version">' + esc(t('profile.version', { v: APP_VERSION })) + '</p>' +
      '<button type="button" class="btn-logout" data-action="profile-logout">' + ICONS.logout + '<span>' + esc(t('profile.logout')) + '</span></button>' +
      C.bottomTab('profile') +
    '</div>';
  }

  function confirmLogout() {
    document.body.insertAdjacentHTML('beforeend', C.modal(t('profile.logout'), '<p>' + esc(t('profile.logout.confirm')) + '</p>', {
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>' + esc(t('common.cancel')) + '</button>' +
        '<button type="button" class="btn btn-danger" data-action="profile-logout-confirm">' + esc(t('profile.logout')) + '</button>'
    }));
  }

  function renderProfile() {
    destroyProfile();
    var root = app();
    root.innerHTML = C.loading(t('common.loading'));
    Promise.all([TTV.api.getCurrentUser(), TTV.api.getProfileStats()]).then(function (parts) {
      var user = parts[0];
      if (!user) { TTV.api.logoutAndGo(); return; } // phiên trỏ tới tài khoản không còn
      root.innerHTML = profileMarkup(user, parts[1] || { completed: 0, processing: 0 }, TTV.NotiLive ? TTV.NotiLive.unread() : 0);
      bindAvatarFallback(root, user.name);
      if (stopUnread) stopUnread();
      stopUnread = TTV.Utils.watchUnread(root);
      docHandler = function (e) {
        var row = e.target.closest('[data-menu-route]');
        if (row && root.contains(row)) {
          var route = row.getAttribute('data-menu-route');
          if (TTV.Router.has(route)) TTV.Router.navigate(route); else C.toast(t('profile.soon.toast'), 'info');
          return;
        }
        if (e.target.closest('[data-action="profile-logout"]')) { confirmLogout(); return; }
        if (e.target.closest('[data-action="profile-logout-confirm"]')) {
          var overlay = e.target.closest('.modal-backdrop'); if (overlay) overlay.remove();
          TTV.api.logoutAndGo().then(function () { C.toast(t('profile.logout.done'), 'success'); });
        }
      };
      document.addEventListener('click', docHandler);
    }).catch(function (err) {
      root.innerHTML = C.header(t('profile.title'), { back: false }) + '<main class="page">' + C.emptyState(t('profile.loadError'), err.message || t('common.error')) + '</main>' + C.bottomTab('profile');
    });
  }
  function destroyProfile() {
    if (stopUnread) { stopUnread(); stopUnread = null; }
    if (docHandler) { document.removeEventListener('click', docHandler); docHandler = null; }
    var m = document.querySelector('.modal-backdrop'); if (m) m.remove();
  }

  /* ===================== #/profile/info ===================== */
  var infoPreviewUrl = null;
  function revokePreview() { if (infoPreviewUrl) { URL.revokeObjectURL(infoPreviewUrl); infoPreviewUrl = null; } }

  function renderInfo() {
    destroyInfo();
    var root = app();
    root.innerHTML = C.header(t('profile.info.title'), { back: true }) + '<main class="page">' + C.loading(t('common.loading')) + '</main>';
    TTV.api.getCurrentUser().then(function (user) {
      if (!user) { TTV.api.logoutAndGo(); return; }
      drawInfo(root, user);
    }).catch(function (err) {
      root.innerHTML = C.header(t('profile.info.title'), { back: true }) + '<main class="page">' + C.emptyState(t('profile.loadError'), err.message || t('common.error')) + '</main>';
    });
  }
  function destroyInfo() { revokePreview(); }

  function drawInfo(root, user) {
    var genderOptions = '<option value="">' + esc(t('profile.gender.placeholder')) + '</option>' + TTV.api.GENDERS.map(function (g) {
      return '<option value="' + g.value + '"' + (user.gender === g.value ? ' selected' : '') + '>' + esc(g.label) + '</option>';
    }).join('');
    root.innerHTML = C.header(t('profile.info.title'), { back: true }) +
      '<main class="page info-page"><form id="info-form" novalidate>' +
        '<div class="info-avatar"><div class="info-avatar__img" id="info-avatar">' + avatarInner(user.name, user.avatar_path) + '</div>' +
          '<label class="info-avatar__change">' + ICONS.edit + '<span>' + esc(t('profile.avatar.change')) + '</span><input type="file" id="info-file" accept="image/*" hidden></label></div>' +
        '<label class="field"><span class="field__label">' + esc(t('profile.field.name')) + '</span><input id="info-name" type="text" autocomplete="name" maxlength="80" value="' + esc(user.name) + '"></label>' +
        '<p class="field-error field-error--reserved" id="info-name-error">' + esc(t('profile.error.name')) + '</p>' +
        '<div class="field"><span class="field__label">' + esc(t('profile.field.phone')) + '</span><div class="field-locked"><span>' + esc(user.phone || displayPhone(user)) + '</span>' + ICONS.lock + '</div>' +
          '<p class="field-hint">' + ICONS.lock + '<span>' + esc(t('profile.phone.locked')) + '</span></p></div>' +
        '<label class="field"><span class="field__label">' + esc(t('profile.field.email')) + '</span><input id="info-email" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="' + esc(t('profile.email.placeholder')) + '" value="' + esc(user.email) + '"></label>' +
        '<p class="field-error field-error--reserved" id="info-email-error">' + esc(t('profile.error.email')) + '</p>' +
        '<label class="field"><span class="field__label">' + esc(t('profile.field.gender')) + '</span><select id="info-gender">' + genderOptions + '</select></label>' +
        '<label class="field"><span class="field__label">' + esc(t('profile.field.dob')) + '</span><input id="info-dob" type="date" min="1900-01-01" max="' + TTV.api.todayIso() + '" value="' + esc(user.dob) + '"></label>' +
        '<p class="field-error" id="info-error" role="alert" hidden></p>' +
        '<div class="page-action"><button type="submit" class="btn btn-primary btn-block" id="info-submit" disabled>' + ICONS.save + '<span>' + esc(t('profile.save')) + '</span></button></div>' +
      '</form></main>';
    bindAvatarFallback(root, user.name);

    var form = $(root, '#info-form'), name = $(root, '#info-name'), email = $(root, '#info-email'), gender = $(root, '#info-gender'), dob = $(root, '#info-dob'),
      file = $(root, '#info-file'), avatarBox = $(root, '#info-avatar'), submit = $(root, '#info-submit'), err = $(root, '#info-error'),
      nameErr = $(root, '#info-name-error'), emailErr = $(root, '#info-email-error'), pendingFile = null, busy = false;
    var original = { name: user.name || '', email: user.email || '', gender: user.gender || '', dob: user.dob || '' };

    function showError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function nameOk() { return name.value.trim().replace(/\s+/g, ' ').length >= 2; }
    function emailOk() { return TTV.api.isValidEmail(email.value); }
    function dobOk() { return !dob.value || TTV.api.isValidDob(dob.value); }
    function dirty() {
      return pendingFile !== null || name.value.trim().replace(/\s+/g, ' ') !== original.name || email.value.trim() !== original.email ||
        gender.value !== original.gender || dob.value !== original.dob;
    }
    function refresh() {
      // Chỉ báo lỗi khi đã rời ô (không báo khi đang gõ); luôn giữ chỗ để bố cục không nhảy.
      nameErr.style.visibility = (nameOk() || document.activeElement === name) ? 'hidden' : 'visible';
      emailErr.style.visibility = (emailOk() || document.activeElement === email) ? 'hidden' : 'visible';
      submit.disabled = busy || !(dirty() && nameOk() && emailOk() && dobOk());
    }
    [name, email, gender, dob].forEach(function (el) {
      el.addEventListener('input', function () { showError(''); refresh(); });
      el.addEventListener('change', function () { showError(''); refresh(); });
      el.addEventListener('blur', refresh);
    });

    // Chọn ảnh: chỉ xem trước; file chỉ được ghi vào uploads/ khi bấm Lưu (không để file mồ côi nếu người dùng thoát).
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { showError(t('profile.error.avatarType')); return; }
      if (f.size > MAX_AVATAR_BYTES) { showError(t('profile.error.avatarSize')); return; }
      revokePreview();
      infoPreviewUrl = URL.createObjectURL(f);
      pendingFile = f;
      avatarBox.innerHTML = '<img src="' + esc(infoPreviewUrl) + '" alt="">';
      showError(''); refresh();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit.disabled) return;
      busy = true; submit.disabled = true; submit.querySelector('span').textContent = t('profile.saving'); showError('');
      var upload = pendingFile ? TTV.Upload.upload(pendingFile, { ownerId: user.id, kind: 'avatar' }).then(function (r) { return r.path; }) : Promise.resolve(undefined);
      upload.catch(function (e2) {
        var wrapped = new Error(t('profile.error.avatarSave', { reason: (e2 && e2.message) || '' }));
        wrapped.code = 'UPLOAD';
        throw wrapped;
      }).then(function (path) {
        return TTV.api.updateProfile({ name: name.value, email: email.value, gender: gender.value, dob: dob.value, avatar_path: path });
      }).then(function () {
        revokePreview();
        C.toast(t('profile.saved'), 'success');
        TTV.Router.navigate('/profile');
      }).catch(function (e2) {
        busy = false; submit.querySelector('span').textContent = t('profile.save'); refresh();
        showError(e2.message || t('profile.error.save'));
      });
    });
    refresh();
  }

  TTV.screens.profile = { renderProfile: renderProfile, renderInfo: renderInfo, destroy: function () { destroyProfile(); destroyInfo(); } };
  var customerOnly = { roles: ['CUSTOMER'], loginRoute: '/login', deniedRoute: '/login' };
  TTV.Router.add('/profile', renderProfile, Object.assign({ destroy: destroyProfile }, customerOnly));
  TTV.Router.add('/profile/info', renderInfo, Object.assign({ destroy: destroyInfo }, customerOnly));
})(window.TTV);
