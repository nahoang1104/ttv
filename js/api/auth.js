/* auth.js — băm mật khẩu (SHA-256 + salt) và session theo tab (task 2.1).
   Session lưu ở sessionStorage của TAB hiện tại (mở 3 tab test 3 vai trò cùng lúc) và ghi thêm một dòng vào bảng `sessions`.
   Lưu ý: chỉ là rào cản phía trình duyệt, phù hợp bản demo. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var SESSION_KEY = 'ttv_session';
  var TOUCH_INTERVAL_MS = 30000;
  var lastTouch = 0;

  /* ===== Băm mật khẩu ===== */
  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function randomSalt(bytes) {
    var arr = new Uint8Array(bytes || 16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function sha256Hex(text) {
    if (!(window.crypto && crypto.subtle)) {
      return Promise.reject(new Error('Trình duyệt cần crypto.subtle (mở qua http://localhost hoặc https).'));
    }
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(bytesToHex);
  }
  // hash = SHA-256(salt + ':' + mật khẩu)
  function hashPassword(password, salt) {
    return sha256Hex(String(salt) + ':' + String(password));
  }
  // Tạo cặp {salt, password_hash} mới cho một mật khẩu (dùng ở 2.4, 3.2, 3.3, reset mật khẩu).
  function makeCredentials(password) {
    var salt = randomSalt(16);
    return hashPassword(password, salt).then(function (hash) { return { salt: salt, password_hash: hash }; });
  }
  function safeEqual(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  function verifyPassword(password, salt, expectedHash) {
    if (!salt || !expectedHash) return Promise.resolve(false);
    return hashPassword(password, salt).then(function (hash) { return safeEqual(hash, expectedHash); });
  }

  /* ===== Thông tin thiết bị (cho bảng sessions) ===== */
  function deviceInfo() {
    var ua = navigator.userAgent || '', platform = 'Web', browser = 'Trình duyệt';
    if (/Windows/i.test(ua)) platform = 'Windows';
    else if (/Android/i.test(ua)) platform = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
    else if (/Mac OS X|Macintosh/i.test(ua)) platform = 'macOS';
    else if (/Linux/i.test(ua)) platform = 'Linux';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';
    return { device_name: browser + ' trên ' + platform, platform: platform };
  }

  /* ===== Session theo tab ===== */
  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
  }
  function writeSession(session) {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) { /* sessionStorage bị chặn: bỏ qua, phiên chỉ sống trong bộ nhớ DB */ }
  }
  // account = { type:'customer'|'vendor'|'staff', id, role:'CUSTOMER'|'VENDOR'|'SUPER_ADMIN', name }
  function createSession(account) {
    if (!account || !account.type || !account.id || !account.role) return Promise.reject(new Error('Thiếu thông tin tài khoản để tạo phiên.'));
    var info = deviceInfo(), now = new Date().toISOString();
    var row = {
      id: TTV.Utils.id(), device_name: info.device_name, platform: info.platform,
      last_active: now, is_current: true, account_type: account.type, account_id: String(account.id), created_at: now
    };
    return TTV.Store.put('sessions', row).then(function () {
      var session = {
        id: row.id, role: account.role, account_type: account.type, account_id: String(account.id),
        name: account.name || '', created_at: now
      };
      writeSession(session);
      lastTouch = Date.now();
      return session;
    });
  }
  function getSession() { return readSession(); }
  function getRole() { var s = readSession(); return s ? s.role : null; }
  function isLoggedIn() { return !!readSession(); }
  // Cập nhật last_active (giới hạn tần suất để khỏi ghi DB liên tục).
  function touch(force) {
    var s = readSession();
    if (!s || (!force && Date.now() - lastTouch < TOUCH_INTERVAL_MS)) return Promise.resolve(false);
    lastTouch = Date.now();
    return TTV.Store.get('sessions', s.id).then(function (row) {
      if (!row) return false;
      row.last_active = new Date().toISOString();
      return TTV.Store.put('sessions', row).then(function () { return true; });
    }).catch(function () { return false; });
  }
  // Cập nhật tên hiển thị trong session (sau onboarding, đổi hồ sơ).
  function updateSession(patch) {
    var s = readSession();
    if (!s) return null;
    s = Object.assign({}, s, patch || {});
    writeSession(s);
    return s;
  }
  // Xóa phiên của tab hiện tại (đăng xuất).
  function destroySession() {
    var s = readSession();
    writeSession(null);
    if (!s) return Promise.resolve(false);
    return TTV.Store.remove('sessions', s.id).then(function () { return true; }).catch(function () { return false; });
  }
  function listSessions(accountType, accountId) {
    return TTV.Store.query('sessions', { account_type: accountType, account_id: String(accountId) }).then(function (rows) {
      var current = readSession();
      return rows.map(function (r) { return Object.assign({}, r, { is_current: !!(current && current.id === r.id) }); });
    });
  }

  TTV.auth = TTV.Auth = {
    SESSION_KEY: SESSION_KEY,
    randomSalt: randomSalt, sha256Hex: sha256Hex, hashPassword: hashPassword,
    makeCredentials: makeCredentials, verifyPassword: verifyPassword,
    deviceInfo: deviceInfo, createSession: createSession, getSession: getSession, getRole: getRole,
    isLoggedIn: isLoggedIn, touch: touch, updateSession: updateSession, destroySession: destroySession, listSessions: listSessions
  };
})(window.TTV);
