/* ttv-api.js — nghiệp vụ. Màn hình chỉ gọi qua TTV.api, không gọi store trực tiếp. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var api = TTV.api = TTV.api || {};

  /* ===== 2.2 Đăng nhập khách: SĐT +84 + OTP giả lập, Zalo/Google demo ===== */
  var OTP_CODE = '123456';          // OTP giả lập cố định (hiện trong toast)
  var OTP_MAX_ATTEMPTS = 5;         // sai 5 lần thì khóa tạm
  var OTP_LOCK_MS = 5 * 60 * 1000;  // thời gian khóa tạm
  var OTP_RESEND_MS = 60 * 1000;    // đếm ngược gửi lại
  var OTP_TTL_MS = 5 * 60 * 1000;   // mã hết hạn sau 5 phút
  var CHALLENGE_KEY = 'ttv_otp_challenge'; // thử thách OTP đang chờ, theo tab

  function fail(code, message, extra) {
    var e = new Error(message); e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  function normalizePhone(input) {
    var raw = String(input == null ? '' : input).replace(/[\s.\-()]/g, '');
    var national;
    if (raw.charAt(0) === '+') {
      if (raw.indexOf('+84') !== 0) return { ok: false, error: 'Hiện chỉ hỗ trợ số điện thoại Việt Nam (+84).' };
      national = raw.slice(3);
    } else if (raw.indexOf('0084') === 0) national = raw.slice(4);
    else if (raw.indexOf('84') === 0 && raw.length === 11) national = raw.slice(2);
    else if (raw.charAt(0) === '0') national = raw.slice(1);
    else national = raw;
    if (national.charAt(0) === '0') national = national.slice(1);
    if (!/^\d+$/.test(national) || !/^[35789]\d{8}$/.test(national)) return { ok: false, error: 'Số điện thoại không hợp lệ.' };
    return { ok: true, e164: '+84' + national, local: '0' + national };
  }
  function maskLocalPhone(local) {
    local = String(local || '');
    if (local.length < 7) return local;
    return local.slice(0, 3) + ' ' + new Array(local.length - 5).join('*') + local.slice(-3);
  }

  function readChallenge() { try { return JSON.parse(sessionStorage.getItem(CHALLENGE_KEY) || 'null'); } catch (_) { return null; } }
  function writeChallenge(c) { try { if (c) sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(c)); else sessionStorage.removeItem(CHALLENGE_KEY); } catch (_) {} }

  function attemptKey(e164) { return 'otp_attempts:' + e164; }
  function readAttempts(e164) {
    return TTV.Store.get('__meta', attemptKey(e164)).then(function (row) {
      var now = Date.now();
      if (!row) return { id: attemptKey(e164), attempts_left: OTP_MAX_ATTEMPTS, locked_until: 0 };
      if (row.locked_until && row.locked_until <= now) return { id: row.id, attempts_left: OTP_MAX_ATTEMPTS, locked_until: 0 };
      return row;
    });
  }
  function writeAttempts(row) { return TTV.Store.put('__meta', row); }

  function sendCode(phone) {
    var now = Date.now();
    var old = readChallenge();
    var c = {
      phone: phone.e164, local: phone.local, code: OTP_CODE,
      sent_at: now, resend_at: now + OTP_RESEND_MS, expires_at: now + OTP_TTL_MS,
      method: 'phone', send_count: (old && old.phone === phone.e164 ? old.send_count || 1 : 0) + 1
    };
    writeChallenge(c);
    return c;
  }

  api.requestOtp = function (phoneInput) {
    var phone = normalizePhone(phoneInput);
    if (!phone.ok) return Promise.reject(fail('INVALID_PHONE', phone.error));
    return readAttempts(phone.e164).then(function (state) {
      if (state.locked_until > Date.now()) return Promise.reject(fail('LOCKED', 'Bạn đã nhập sai OTP quá nhiều lần.', { locked_until: state.locked_until }));
      var c = sendCode(phone);
      return { phone: c.phone, local: c.local, masked: maskLocalPhone(c.local), code: c.code };
    });
  };

  api.resendOtp = function () {
    var c = readChallenge();
    if (!c) return Promise.reject(fail('NO_CHALLENGE', 'Phiên xác thực đã hết, hãy nhập lại số điện thoại.'));
    if (Date.now() < c.resend_at) return Promise.reject(fail('TOO_SOON', 'Chưa thể gửi lại mã.', { wait_ms: c.resend_at - Date.now() }));
    return readAttempts(c.phone).then(function (state) {
      if (state.locked_until > Date.now()) return Promise.reject(fail('LOCKED', 'Bạn đã nhập sai OTP quá nhiều lần.', { locked_until: state.locked_until }));
      var n = sendCode({ e164: c.phone, local: c.local });
      return { code: n.code };
    });
  };

  api.getOtpState = function () {
    var c = readChallenge();
    if (!c) return Promise.resolve(null);
    return readAttempts(c.phone).then(function (state) {
      return {
        phone: c.phone, local: c.local, masked: maskLocalPhone(c.local),
        attempts_left: state.attempts_left, max_attempts: OTP_MAX_ATTEMPTS,
        locked_until: state.locked_until > Date.now() ? state.locked_until : 0,
        resend_at: c.resend_at, expired: Date.now() > c.expires_at, code: c.code
      };
    });
  };

  api.cancelOtp = function () { writeChallenge(null); };

  function newUser(fields) {
    return Object.assign({
      id: TTV.Utils.id(), phone: '', name: '', email: '', gender: '', dob: '', avatar_path: '',
      login_method: 'phone', kyc_status: 'none', default_pay_method: 'cash', wallet_balance: 0,
      lang: 'vi', theme: 'light', created_at: new Date().toISOString()
    }, fields || {});
  }
  api.needsOnboarding = function (user) { return !user || !String(user.name || '').trim(); };

  function startCustomerSession(user, isNew) {
    return TTV.auth.createSession({ type: 'customer', id: user.id, role: 'CUSTOMER', name: user.name }).then(function () {
      return { user: user, isNew: isNew, next: api.needsOnboarding(user) ? '/onboarding' : '/home' };
    });
  }

  api.verifyOtp = function (code) {
    var c = readChallenge();
    if (!c) return Promise.reject(fail('NO_CHALLENGE', 'Phiên xác thực đã hết, hãy nhập lại số điện thoại.'));
    code = String(code || '').trim();
    return readAttempts(c.phone).then(function (state) {
      if (state.locked_until > Date.now()) return Promise.reject(fail('LOCKED', 'Bạn đã nhập sai OTP quá nhiều lần.', { locked_until: state.locked_until }));
      if (Date.now() > c.expires_at) return Promise.reject(fail('EXPIRED', 'Mã OTP đã hết hạn, hãy gửi lại mã.'));
      if (!/^\d{6}$/.test(code)) return Promise.reject(fail('INVALID_FORMAT', 'Vui lòng nhập đủ 6 chữ số.', { attempts_left: state.attempts_left }));
      if (code !== c.code) {
        state.attempts_left = Math.max(0, state.attempts_left - 1);
        if (state.attempts_left === 0) { state.locked_until = Date.now() + OTP_LOCK_MS; writeChallenge(null); }
        return writeAttempts(state).then(function () {
          if (state.attempts_left === 0) throw fail('LOCKED', 'Bạn đã nhập sai OTP quá nhiều lần.', { locked_until: state.locked_until, attempts_left: 0 });
          throw fail('WRONG_CODE', 'Mã OTP không đúng.', { attempts_left: state.attempts_left });
        });
      }
      return TTV.Store.remove('__meta', attemptKey(c.phone)).then(function () {
        return TTV.Store.query('users', { phone: c.phone });
      }).then(function (rows) {
        var user = rows[0], isNew = !user;
        return (isNew ? TTV.Store.put('users', newUser({ phone: c.phone, login_method: 'phone' })) : Promise.resolve(user)).then(function (u) {
          writeChallenge(null);
          return startCustomerSession(u, isNew);
        });
      });
    });
  };

  api.loginDemo = function (method) {
    if (method !== 'zalo' && method !== 'google') return Promise.reject(fail('INVALID_METHOD', 'Phương thức đăng nhập không hợp lệ.'));
    var id = 'demo-' + method;
    return TTV.Store.get('users', id).then(function (existing) {
      var isNew = !existing;
      return (isNew ? TTV.Store.put('users', newUser({ id: id, login_method: method })) : Promise.resolve(existing)).then(function (u) {
        writeChallenge(null);
        return startCustomerSession(u, isNew);
      });
    });
  };

  api.getCurrentUser = function () {
    var s = TTV.auth.getSession();
    if (!s || s.account_type !== 'customer') return Promise.resolve(null);
    return TTV.Store.get('users', s.account_id);
  };
  /* ===== 2.5 Đăng xuất, kiểm tra phiên ===== */
  api.loginRouteFor = function (role) { return role === 'CUSTOMER' ? '/login' : '/staff-login'; };
  // Đăng xuất: xóa thử thách OTP, bản nháp điểm trả và phiên của tab; staff ghi audit `auth.logout` (ghi trước khi xóa phiên).
  api.logout = function () {
    var s = TTV.auth.getSession();
    writeChallenge(null);
    try { sessionStorage.removeItem('ttv_draft_dropoff'); sessionStorage.removeItem('ttv_draft_order'); } catch (_) {}
    var log = s && STAFF_ROLES.indexOf(s.role) >= 0
      ? TTV.Utils.audit('auth.logout', { target_table: 'staff', target_id: s.account_id, actor_id: s.account_id, actor_role: s.role }).catch(function () {})
      : Promise.resolve();
    return log.then(function () { return TTV.auth.destroySession(); });
  };
  // Đăng xuất rồi về đúng trang đăng nhập của vai trò vừa thoát (thay mục lịch sử để Back không quay lại).
  api.logoutAndGo = function () {
    var s = TTV.auth.getSession(), to = api.loginRouteFor(s && s.role);
    return api.logout().then(function () { TTV.Router.navigate(to, { replace: true }); });
  };
  // Khách chưa có họ tên (chưa qua onboarding) thì chưa được vào các màn khác của khu khách.
  api.sessionNeedsOnboarding = function (session) { return !!session && session.role === 'CUSTOMER' && !String(session.name || '').trim(); };
  // Chạy lúc khởi động: phiên trỏ tới tài khoản đã bị xóa (ví dụ xóa DB) hoặc bị khóa thì hủy; đồng bộ tên và cờ đổi mật khẩu.
  api.validateSession = function () {
    var s = TTV.auth.getSession();
    if (!s) return Promise.resolve(null);
    var table = { customer: 'users', vendor: 'vendors', staff: 'staff' }[s.account_type];
    if (!table) return TTV.auth.destroySession().then(function () { return null; });
    return TTV.Store.get(table, s.account_id).then(function (row) {
      if (!row || row.status === 'locked') return TTV.auth.destroySession().then(function () { return null; });
      var patch = {};
      if ((row.name || '') !== (s.name || '')) patch.name = row.name || '';
      if (table !== 'users' && !!row.must_change_pw !== !!s.must_change_pw) patch.must_change_pw = !!row.must_change_pw;
      return Object.keys(patch).length ? TTV.auth.updateSession(patch) : s;
    }).catch(function () { return s; }); // lỗi đọc DB: giữ phiên, không đá người dùng ra
  };

  api.normalizePhone = normalizePhone;
  api.OTP = { MAX_ATTEMPTS: OTP_MAX_ATTEMPTS, LOCK_MS: OTP_LOCK_MS, RESEND_MS: OTP_RESEND_MS };

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  api.isValidEmail = function (email) { return EMAIL_RE.test(String(email || '').trim()); };
  api.getPolicy = function (type) { return TTV.Store.get('policies', type); };
  api.completeOnboarding = function (data) {
    var s = TTV.auth.getSession();
    if (!s || s.account_type !== 'customer') return Promise.reject(fail('NO_SESSION', 'Phiên đăng nhập đã hết, hãy đăng nhập lại.'));
    var name = String((data && data.name) || '').trim().replace(/\s+/g, ' '), email = String((data && data.email) || '').trim();
    if (name.length < 2) return Promise.reject(fail('INVALID_NAME', 'Vui lòng nhập họ và tên.'));
    if (name.length > 80) return Promise.reject(fail('INVALID_NAME', 'Họ và tên tối đa 80 ký tự.'));
    if (!api.isValidEmail(email)) return Promise.reject(fail('INVALID_EMAIL', 'Email không hợp lệ.'));
    if (!data.accepted_terms) return Promise.reject(fail('TERMS_REQUIRED', 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật.'));
    return TTV.Store.get('users', s.account_id).then(function (user) {
      if (!user) throw fail('NO_USER', 'Không tìm thấy tài khoản.');
      var saved = Object.assign({}, user, { name: name, email: email, terms_accepted_at: new Date().toISOString() });
      return TTV.Store.put('users', saved);
    }).then(function (user) { TTV.auth.updateSession({ name: user.name }); return user; });
  };

  var STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];
  var STAFF_MAX_FAILS = 5, STAFF_LOCK_MS = 5 * 60 * 1000;
  api.STAFF_ROLES = STAFF_ROLES;
  api.homeRouteFor = function (role) {
    if (role === 'CUSTOMER') return '/home';
    if (role === 'VENDOR') return '/vendor';
    if (STAFF_ROLES.indexOf(role) >= 0) return '/admin';
    return '/';
  };
  api.isStaffSide = function (role) { return role === 'VENDOR' || STAFF_ROLES.indexOf(role) >= 0; };

  api.ensureSeedStaff = function () {
    var cfg = window.TTV_CONFIG || {}, username = cfg.seedUser || 'admin', password = cfg.seedPassword;
    if (!password) return Promise.resolve(false);
    return TTV.Store.get('staff', username).then(function (row) {
      if (!row || row.password_hash) return false;
      return TTV.auth.makeCredentials(password).then(function (cred) {
        var next = Object.assign({}, row, cred, { must_change_pw: true });
        delete next.seed_password_hint;
        return TTV.Store.put('staff', next).then(function () { return true; });
      });
    });
  };

  function failKey(username) { return 'staff_fails:' + username; }
  function readFails(username) {
    return TTV.Store.get('__meta', failKey(username)).then(function (row) {
      if (!row) return { id: failKey(username), fails: 0, locked_until: 0 };
      if (row.locked_until && row.locked_until <= Date.now()) return { id: row.id, fails: 0, locked_until: 0 };
      return row;
    });
  }
  function findAccount(username) {
    return TTV.Store.query('staff', function (r) { return String(r.username || '').toLowerCase() === username; }).then(function (rows) {
      if (rows[0]) return { type: 'staff', row: rows[0], table: 'staff' };
      return TTV.Store.query('vendors', function (r) { return String(r.username || '').toLowerCase() === username; }).then(function (v) {
        return v[0] ? { type: 'vendor', row: v[0], table: 'vendors' } : null;
      });
    });
  }

  api.loginStaff = function (usernameInput, password) {
    var username = String(usernameInput || '').trim().toLowerCase();
    if (!username || !password) return Promise.reject(fail('MISSING', 'Vui lòng nhập tên đăng nhập và mật khẩu.'));
    return api.ensureSeedStaff().then(function () { return readFails(username); }).then(function (state) {
      if (state.locked_until > Date.now()) throw fail('LOCKED', 'Đăng nhập sai quá nhiều lần.', { locked_until: state.locked_until });
      return findAccount(username).then(function (acc) {
        var check = acc ? TTV.auth.verifyPassword(password, acc.row.salt, acc.row.password_hash) : Promise.resolve(false);
        return check.then(function (ok) {
          if (!ok) {
            state.fails += 1;
            if (state.fails >= STAFF_MAX_FAILS) { state.locked_until = Date.now() + STAFF_LOCK_MS; state.fails = 0; }
            return TTV.Store.put('__meta', state).then(function () {
              if (state.locked_until > Date.now()) throw fail('LOCKED', 'Đăng nhập sai quá nhiều lần.', { locked_until: state.locked_until });
              throw fail('BAD_CREDENTIALS', 'Sai tên đăng nhập hoặc mật khẩu.', { attempts_left: STAFF_MAX_FAILS - state.fails });
            });
          }
          if (acc.row.status === 'locked') throw fail('ACCOUNT_LOCKED', 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
          var role = acc.type === 'vendor' ? 'VENDOR' : acc.row.role, mustChange = !!acc.row.must_change_pw;
          return TTV.Store.remove('__meta', failKey(username)).then(function () {
            return TTV.auth.createSession({ type: acc.type, id: acc.row.id, role: role, name: acc.row.name });
          }).then(function () {
            TTV.auth.updateSession({ must_change_pw: mustChange });
            return (acc.type === 'staff' ? TTV.Utils.audit('auth.login', { target_table: 'staff', target_id: acc.row.id }) : Promise.resolve()).catch(function () {});
          }).then(function () {
            return { role: role, must_change_pw: mustChange, next: mustChange ? '/change-password' : api.homeRouteFor(role) };
          });
        });
      });
    });
  };

  api.validatePassword = function (pw) {
    pw = String(pw || '');
    if (pw.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
    if (pw.length > 64) return 'Mật khẩu tối đa 64 ký tự.';
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mật khẩu cần có cả chữ và số.';
    return '';
  };

  api.changePassword = function (newPassword, confirmPassword) {
    var s = TTV.auth.getSession();
    if (!s || !api.isStaffSide(s.role)) return Promise.reject(fail('NO_SESSION', 'Phiên đăng nhập đã hết, hãy đăng nhập lại.'));
    var msg = api.validatePassword(newPassword);
    if (msg) return Promise.reject(fail('WEAK_PASSWORD', msg));
    if (newPassword !== confirmPassword) return Promise.reject(fail('MISMATCH', 'Mật khẩu nhập lại không khớp.'));
    var table = s.account_type === 'vendor' ? 'vendors' : 'staff';
    return TTV.Store.get(table, s.account_id).then(function (row) {
      if (!row) throw fail('NO_USER', 'Không tìm thấy tài khoản.');
      return TTV.auth.verifyPassword(newPassword, row.salt, row.password_hash).then(function (same) {
        if (same) throw fail('SAME_PASSWORD', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
        return TTV.auth.makeCredentials(newPassword);
      }).then(function (cred) {
        return TTV.Store.put(table, Object.assign({}, row, cred, { must_change_pw: false }));
      });
    }).then(function () {
      TTV.auth.updateSession({ must_change_pw: false });
      if (table === 'staff') return TTV.Utils.audit('auth.change_password', { target_table: 'staff', target_id: s.account_id }).catch(function () {});
    }).then(function () { return { next: api.homeRouteFor(s.role) }; });
  };

  /* ===== 2.6 Hồ sơ khách: Cá nhân, Thông tin cá nhân ===== */
  api.GENDERS = [{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }];
  api.KYC_LABELS = { none: 'Chưa định danh', pending: 'Đang chờ duyệt', verified: 'Đã định danh', rejected: 'Bị từ chối' };
  function customerSession() { var s = TTV.auth.getSession(); return s && s.account_type === 'customer' ? s : null; }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  api.todayIso = todayIso;
  api.isValidDob = function (value) {
    value = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var p = value.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return false; // loại 31/02...
    return p[0] >= 1900 && value <= todayIso();
  };
  // Số đơn hoàn thành / đang xử lý (mọi đơn chưa hoàn thành và chưa hủy) của khách đang đăng nhập.
  api.getProfileStats = function () {
    var s = customerSession();
    if (!s) return Promise.resolve({ completed: 0, processing: 0 });
    return TTV.Store.query('orders', { user_id: s.account_id }).then(function (rows) {
      var out = { completed: 0, processing: 0 };
      (rows || []).forEach(function (o) {
        if (o.status === 'completed') out.completed += 1;
        else if (o.status !== 'cancelled') out.processing += 1;
      });
      return out;
    });
  };
  // Lưu hồ sơ. SĐT không bao giờ được sửa ở đây; avatar_path chỉ nhận đường dẫn uploads/… (hoặc rỗng để xóa).
  api.updateProfile = function (data) {
    var s = customerSession();
    if (!s) return Promise.reject(fail('NO_SESSION', 'Phiên đăng nhập đã hết, hãy đăng nhập lại.'));
    data = data || {};
    var name = String(data.name || '').trim().replace(/\s+/g, ' '), email = String(data.email || '').trim();
    var gender = String(data.gender || ''), dob = String(data.dob || '');
    if (name.length < 2) return Promise.reject(fail('INVALID_NAME', 'Vui lòng nhập họ và tên.'));
    if (name.length > 80) return Promise.reject(fail('INVALID_NAME', 'Họ và tên tối đa 80 ký tự.'));
    if (!api.isValidEmail(email)) return Promise.reject(fail('INVALID_EMAIL', 'Email không hợp lệ.'));
    if (gender && !api.GENDERS.some(function (g) { return g.value === gender; })) return Promise.reject(fail('INVALID_GENDER', 'Giới tính không hợp lệ.'));
    if (dob && !api.isValidDob(dob)) return Promise.reject(fail('INVALID_DOB', 'Ngày sinh không hợp lệ.'));
    var avatar = data.avatar_path;
    if (avatar != null && avatar !== '' && !/^uploads\/[A-Za-z0-9_\-\/]+\.[A-Za-z0-9]{1,8}$/.test(String(avatar))) return Promise.reject(fail('INVALID_AVATAR', 'Đường dẫn ảnh đại diện không hợp lệ.'));
    return TTV.Store.get('users', s.account_id).then(function (user) {
      if (!user) throw fail('NO_USER', 'Không tìm thấy tài khoản.');
      var next = Object.assign({}, user, { name: name, email: email, gender: gender, dob: dob, updated_at: new Date().toISOString() });
      if (avatar != null) next.avatar_path = String(avatar);
      return TTV.Store.put('users', next);
    }).then(function (user) { TTV.auth.updateSession({ name: user.name }); return user; });
  };

  function store() {
    if (!TTV.Store) return Promise.reject(new Error('Store chưa sẵn sàng.'));
    return TTV.Store;
  }
  api.listServices = function () {
    var order = ['moving', 'warehouse', 'furniture', 'office', 'construction', 'hourly', 'goods'];
    return store().list('services').then(function (rows) {
      return (rows || []).slice().sort(function (a, b) {
        var ia = order.indexOf(a.code || a.id), ib = order.indexOf(b.code || b.id);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    });
  };

  api.listBanners = function () {
    return store().list('banners').then(function (rows) {
      return (rows || []).filter(function (row) { return row.active !== false; })
        .sort(function (a, b) { return (Number(a.sort) || 0) - (Number(b.sort) || 0); });
    });
  };

  api.getSetting = function (key) {
    return store().get('app_settings', key).then(function (row) {
      return row ? row.value : null;
    });
  };

  api.unreadNotificationCount = function () {
    return store().query('notifications', { is_read: false }).then(function (rows) {
      return (rows || []).length;
    });
  };

  api.listAddresses = function () {
    var s = customerSession();
    if (!s) return Promise.resolve([]);
    return store().query('addresses', { user_id: s.account_id }).then(function (rows) {
      return (rows || []).slice().sort(function (a, b) {
        if (!!a.is_default !== !!b.is_default) return a.is_default ? -1 : 1;
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
    });
  };

  api.getAddress = function (id) {
    var s = customerSession();
    if (!s) return Promise.resolve(null);
    return store().get('addresses', id).then(function (row) {
      if (!row || row.user_id !== s.account_id) return null;
      return row;
    });
  };

  api.saveAddress = function (payload) {
    payload = payload || {};
    var s = customerSession();
    if (!s) return Promise.reject(new Error('Hãy đăng nhập để lưu địa chỉ.'));
    var now = new Date().toISOString();
    var row = {
      id: payload.id || TTV.Utils.id(),
      user_id: s.account_id,
      label: String(payload.label || '').trim().slice(0, 80),
      type: payload.type || 'home',
      detail: String(payload.detail || '').trim().slice(0, 250),
      lat: payload.lat == null ? null : Number(payload.lat),
      lng: payload.lng == null ? null : Number(payload.lng),
      contact_name: String(payload.contact_name || '').trim(),
      contact_phone: String(payload.contact_phone || '').trim(),
      is_default: !!payload.is_default,
      created_at: payload.created_at || now,
      updated_at: now
    };
    if (!row.label || !row.detail) return Promise.reject(new Error('Nhập tên gợi nhớ và địa chỉ chi tiết.'));
    return store().query('addresses', { user_id: s.account_id }).then(function (rows) {
      var ops = [];
      var existing = (rows || []).filter(function (item) { return item.id === row.id; })[0];
      if (existing && existing.created_at) row.created_at = existing.created_at;
      if (row.is_default) {
        (rows || []).forEach(function (item) {
          if (item.id !== row.id && item.is_default) {
            item.is_default = false;
            ops.push(store().put('addresses', item));
          }
        });
      }
      ops.push(store().put('addresses', row));
      return Promise.all(ops).then(function () { return row; });
    });
  };
})(window.TTV);
