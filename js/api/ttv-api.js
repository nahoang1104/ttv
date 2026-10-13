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

  var STAFF_ROLES = ['SUPER_ADMIN']; // chỉ 1 vai trò admin duy nhất
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

  /* ===== 3.3 Tạo tài khoản thợ (admin) ===== */
  // Loại nhà cung cấp và giới hạn số thợ theo loại (cá nhân luôn là 1 thợ).
  api.VENDOR_TYPES = [{ value: 'personal', label: 'Cá nhân' }, { value: 'team', label: 'Tổ đội' }, { value: 'company', label: 'Công ty' }];
  api.VENDOR_TEAM_LIMITS = { personal: { min: 1, max: 1 }, team: { min: 2, max: 50 }, company: { min: 2, max: 500 } };
  // Khu vực hoạt động. TẠM: quận/huyện TP.HCM + "Toàn TP.HCM" (giá trị 'Ho Chi Minh City' khớp seed); chờ chốt ở mục 11 (Câu hỏi mở).
  api.VENDOR_CITY_AREA = 'Ho Chi Minh City';
  api.VENDOR_AREAS = [{ value: 'Ho Chi Minh City', label: 'Toàn TP.HCM' }].concat([
    'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8', 'Quận 10', 'Quận 11', 'Quận 12',
    'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Bình Tân', 'TP. Thủ Đức',
    'Bình Chánh', 'Củ Chi', 'Hóc Môn', 'Nhà Bè', 'Cần Giờ'
  ].map(function (n) { return { value: n, label: n }; }));
  api.VENDOR_VEHICLES = ['Xe máy', 'Xe ba gác', 'Xe bán tải', 'Xe tải nhỏ', 'Xe tải 1.5 tấn', 'Xe tải 2.5 tấn'];
  var USERNAME_RE = /^[a-z0-9][a-z0-9._-]{3,29}$/;
  var COMMISSION_RE = /^\d{1,3}(?:[.,]\d{1,2})?$/;

  // Mật khẩu tạm ngẫu nhiên (crypto), bỏ ký tự dễ nhầm (0/O, 1/l/I); luôn có chữ hoa, chữ thường và số.
  var PW_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ', PW_LOWER = 'abcdefghijkmnpqrstuvwxyz', PW_DIGIT = '23456789';
  function randomInt(max) { // 0..max-1, không lệch (loại mẫu rơi vào phần dư)
    var limit = Math.floor(0x100000000 / max) * max, buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }
  function pickChar(chars) { return chars.charAt(randomInt(chars.length)); }
  api.generateTempPassword = function (length) {
    length = Math.max(8, Math.min(32, Number(length) || 10));
    var all = PW_UPPER + PW_LOWER + PW_DIGIT, out = [pickChar(PW_UPPER), pickChar(PW_LOWER), pickChar(PW_DIGIT), pickChar(PW_DIGIT)];
    while (out.length < length) out.push(pickChar(all));
    for (var i = out.length - 1; i > 0; i--) { var j = randomInt(i + 1), tmp = out[i]; out[i] = out[j]; out[j] = tmp; } // xáo trộn
    return out.join('');
  };

  // Tên đăng nhập: chữ thường không dấu, số, . _ - (4–30 ký tự). Trả '' nếu hợp lệ.
  api.validateUsername = function (input) {
    var u = String(input == null ? '' : input).trim().toLowerCase();
    if (!u) return 'Vui lòng nhập tên đăng nhập.';
    if (!USERNAME_RE.test(u)) return 'Tên đăng nhập gồm 4–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang; bắt đầu bằng chữ hoặc số.';
    return '';
  };
  function vendorSession() { var s = TTV.auth.getSession(); return s && s.role === 'SUPER_ADMIN' ? s : null; }
  function sameUsername(row, u) { return String(row.username || '').toLowerCase() === u; }
  // Tên đăng nhập dùng chung giữa staff và thợ (đăng nhập tìm cả hai bảng) nên phải duy nhất trên cả hai.
  api.isUsernameTaken = function (input) {
    var u = String(input == null ? '' : input).trim().toLowerCase();
    return Promise.all([TTV.Store.list('staff'), TTV.Store.list('vendors')]).then(function (r) {
      return r[0].concat(r[1]).some(function (row) { return sameUsername(row, u); });
    });
  };

  // Kiểm tra dữ liệu (không đụng DB). Trả { ok, errors:{trường:thông báo}, value:{dữ liệu đã chuẩn hóa} }.
  api.validateVendorInput = function (data, opts) {
    data = data || {}; opts = opts || {};
    var withAccount = opts.account !== false; // sửa thông tin: không đụng tên đăng nhập và mật khẩu
    var errors = {}, v = {};
    var type = String(data.type || '');
    if (!api.VENDOR_TYPES.some(function (t) { return t.value === type; })) errors.type = 'Vui lòng chọn loại nhà cung cấp.';
    v.type = type;

    var name = String(data.name == null ? '' : data.name).trim().replace(/\s+/g, ' ');
    if (!name) errors.name = 'Vui lòng nhập tên.';
    else if (name.length < 2) errors.name = 'Tên cần ít nhất 2 ký tự.';
    else if (name.length > 80) errors.name = 'Tên tối đa 80 ký tự.';
    v.name = name;

    var phone = normalizePhone(data.phone);
    if (!String(data.phone == null ? '' : data.phone).trim()) errors.phone = 'Vui lòng nhập số điện thoại.';
    else if (!phone.ok) errors.phone = phone.error;
    v.phone = phone.ok ? phone.local : ''; // thợ lưu dạng 0xxxxxxxxx (như seed)

    var email = String(data.email == null ? '' : data.email).trim();
    if (!email) errors.email = 'Vui lòng nhập email.';
    else if (!api.isValidEmail(email)) errors.email = 'Email không hợp lệ.';
    v.email = email;

    if (withAccount) {
      var uMsg = api.validateUsername(data.username);
      if (uMsg) errors.username = uMsg;
      v.username = String(data.username == null ? '' : data.username).trim().toLowerCase();

      var pw = String(data.password == null ? '' : data.password);
      var pwMsg = api.validatePassword(pw) || (/\s/.test(pw) ? 'Mật khẩu không được chứa khoảng trắng.' : '');
      if (pwMsg) errors.password = pwMsg;
      v.password = pw;
    }

    var lim = api.VENDOR_TEAM_LIMITS[type];
    if (lim) {
      var size = type === 'personal' ? 1 : Number(data.team_size);
      if (!(Number.isInteger(size) && size >= lim.min && size <= lim.max)) errors.team_size = 'Số thợ phải là số nguyên từ ' + lim.min + ' đến ' + lim.max + '.';
      v.team_size = size;
    }

    function uniqueStrings(list) { var out = []; (Array.isArray(list) ? list : []).forEach(function (x) { x = String(x); if (out.indexOf(x) < 0) out.push(x); }); return out; }
    v.services = uniqueStrings(data.services);
    if (!v.services.length) errors.services = 'Chọn ít nhất 1 dịch vụ.';
    v.areas = uniqueStrings(data.areas);
    if (!v.areas.length) errors.areas = 'Chọn ít nhất 1 khu vực hoạt động.';
    else if (v.areas.some(function (a) { return !api.VENDOR_AREAS.some(function (x) { return x.value === a; }); })) errors.areas = 'Có khu vực không hợp lệ.';

    var vehicle = String(data.vehicle == null ? '' : data.vehicle).trim().replace(/\s+/g, ' ');
    if (vehicle.length > 60) errors.vehicle = 'Phương tiện tối đa 60 ký tự.';
    v.vehicle = vehicle;

    // Hoa hồng riêng: để trống = dùng mức mặc định (app_settings.commission_default) → lưu null.
    var rate = data.commission_rate == null ? '' : String(data.commission_rate).trim();
    if (!rate) v.commission_rate = null;
    else if (!COMMISSION_RE.test(rate) || Number(rate.replace(',', '.')) > 100) { errors.commission_rate = 'Hoa hồng phải từ 0 đến 100 (%).'; v.commission_rate = null; }
    else v.commission_rate = Math.round(Number(rate.replace(',', '.')) * 100) / 100;

    return { ok: Object.keys(errors).length === 0, errors: errors, value: v };
  };

  // Kiểm tra trùng tên đăng nhập / SĐT bằng dữ liệu đọc mới nhất.
  function vendorConflicts(v, ignoreId) {
    return Promise.all([TTV.Store.list('vendors'), TTV.Store.list('staff')]).then(function (r) {
      var errs = {};
      if (v.username && r[0].concat(r[1]).some(function (row) { return sameUsername(row, v.username); })) errs.username = 'Tên đăng nhập đã được sử dụng.';
      if (v.phone && r[0].some(function (row) { if (ignoreId && row.id === ignoreId) return false; var n = normalizePhone(row.phone); return n.ok && n.local === v.phone; })) errs.phone = 'Số điện thoại này đã có tài khoản thợ.';
      return errs;
    });
  }

  // Tạo tài khoản thợ (chỉ SUPER_ADMIN). Mật khẩu tạm chỉ được băm, không lưu bản rõ. Lỗi dữ liệu: code 'VALIDATION' kèm err.errors.
  api.createVendor = function (data) {
    var s = vendorSession();
    if (!s) return Promise.reject(fail('FORBIDDEN', 'Bạn không có quyền tạo tài khoản thợ.'));
    var res = api.validateVendorInput(data);
    return Promise.all([TTV.Store.list('services'), vendorConflicts(res.value)]).then(function (r) {
      var codes = r[0].map(function (x) { return x.code || x.id; });
      if (!res.errors.services && res.value.services.some(function (c) { return codes.indexOf(c) < 0; })) res.errors.services = 'Có dịch vụ không hợp lệ.';
      Object.keys(r[1]).forEach(function (k) { if (!res.errors[k]) res.errors[k] = r[1][k]; });
      if (Object.keys(res.errors).length) throw fail('VALIDATION', 'Vui lòng kiểm tra lại các trường được đánh dấu.', { errors: res.errors });
      return TTV.auth.makeCredentials(res.value.password);
    }).then(function (cred) {
      // KIO không có giao dịch: đọc lại ngay trước khi ghi để tránh trùng do tab khác vừa tạo.
      return vendorConflicts(res.value).then(function (errs) {
        if (Object.keys(errs).length) throw fail('VALIDATION', 'Vui lòng kiểm tra lại các trường được đánh dấu.', { errors: errs });
        var v = res.value;
        var record = {
          id: TTV.Utils.id(), name: v.name, type: v.type, username: v.username, phone: v.phone, email: v.email,
          rating: 0, jobs_done: 0, team_size: v.team_size, services: v.services, areas: v.areas, vehicle: v.vehicle,
          commission_rate: v.commission_rate, is_online: false, status: 'active',
          must_change_pw: true, wallet_balance: 0, avatar_path: '', created_by: s.account_id, created_at: new Date().toISOString()
        };
        return TTV.Store.put('vendors', Object.assign(record, cred));
      });
    }).then(function (saved) {
      var detail = { username: saved.username, name: saved.name, type: saved.type, team_size: saved.team_size, services: saved.services, areas: saved.areas, commission_rate: saved.commission_rate };
      return TTV.Utils.audit('vendor.create', { target_table: 'vendors', target_id: saved.id, detail: detail }).catch(function (e) { console.warn('[TTV] audit vendor.create:', e); }).then(function () {
        var safe = Object.assign({}, saved); delete safe.password_hash; delete safe.salt; return safe;
      });
    });
  };
  /* ===== 3.4 Danh sách, chi tiết, khóa/mở, reset mật khẩu, sửa thông tin thợ (admin) ===== */
  // Không bao giờ trả salt/hash ra màn hình.
  function publicVendor(row) {
    if (!row) return null;
    var o = Object.assign({}, row); delete o.password_hash; delete o.salt;
    o.has_password = !!row.password_hash;
    if (!o.status) o.status = 'active';
    return o;
  }
  function adminGuard(message) {
    return vendorSession() ? null : fail('FORBIDDEN', message || 'Bạn không có quyền thực hiện thao tác này.');
  }
  function notFoundVendor() { return fail('NOT_FOUND', 'Không tìm thấy tài khoản thợ.'); }
  function auditSafe(action, details) {
    return TTV.Utils.audit(action, details).catch(function (e) { console.warn('[TTV] audit ' + action + ':', e); });
  }
  // Xóa các phiên đăng nhập của một tài khoản (khóa / reset mật khẩu). Phiên trong sessionStorage của tab khác sẽ bị hủy ở lần tải lại (validateSession).
  function dropAccountSessions(type, id) {
    return TTV.Store.query('sessions', function (r) { return r.account_type === type && String(r.account_id) === String(id); }).then(function (rows) {
      return Promise.all((rows || []).map(function (r) { return TTV.Store.remove('sessions', r.id); }));
    });
  }

  api.listVendors = function () {
    var err = adminGuard('Bạn không có quyền xem danh sách thợ.');
    if (err) return Promise.reject(err);
    return TTV.Store.list('vendors').then(function (rows) {
      return (rows || []).map(publicVendor).sort(function (a, b) {
        var ta = a.created_at || '', tb = b.created_at || '';
        if (ta !== tb) return ta < tb ? 1 : -1; // mới tạo lên đầu; thợ mẫu (không có ngày) xuống cuối
        return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
      });
    });
  };
  api.getVendor = function (id) {
    var err = adminGuard('Bạn không có quyền xem thông tin thợ.');
    if (err) return Promise.reject(err);
    return TTV.Store.get('vendors', String(id)).then(publicVendor);
  };

  // Khóa / mở khóa. Khóa: chặn đăng nhập, tắt "sẵn sàng", hủy các phiên đang có. status: 'locked' | 'active'.
  api.setVendorStatus = function (id, status, reason) {
    var err = adminGuard('Bạn không có quyền khóa hoặc mở khóa tài khoản thợ.');
    if (err) return Promise.reject(err);
    if (status !== 'locked' && status !== 'active') return Promise.reject(fail('VALIDATION', 'Trạng thái không hợp lệ.'));
    reason = String(reason == null ? '' : reason).trim().replace(/\s+/g, ' ');
    if (reason.length > 200) return Promise.reject(fail('VALIDATION', 'Lý do tối đa 200 ký tự.'));
    return TTV.Store.get('vendors', String(id)).then(function (row) {
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === status) return row; // đã đúng trạng thái, không ghi lại
      var now = new Date().toISOString();
      var saved = Object.assign({}, row, { status: status, updated_at: now });
      if (status === 'locked') { saved.is_online = false; saved.locked_at = now; saved.lock_reason = reason; }
      else { saved.locked_at = null; saved.lock_reason = ''; }
      return TTV.Store.put('vendors', saved).then(function (v) {
        var after = status === 'locked' ? dropAccountSessions('vendor', v.id) : Promise.resolve();
        return after.then(function () {
          return auditSafe(status === 'locked' ? 'vendor.lock' : 'vendor.unlock', { target_table: 'vendors', target_id: v.id, detail: { username: v.username, reason: reason } });
        }).then(function () { return v; });
      });
    }).then(publicVendor);
  };

  // Reset mật khẩu: sinh mật khẩu tạm mới, ép đổi ở lần đăng nhập kế tiếp, hủy phiên cũ, gỡ khóa đăng nhập sai. Trả mật khẩu rõ MỘT lần, không lưu.
  api.resetVendorPassword = function (id) {
    var err = adminGuard('Bạn không có quyền đặt lại mật khẩu thợ.');
    if (err) return Promise.reject(err);
    return TTV.Store.get('vendors', String(id)).then(function (row) {
      if (!row) throw notFoundVendor();
      if (!row.username) throw fail('NO_USERNAME', 'Tài khoản thợ này chưa có tên đăng nhập.');
      var password = api.generateTempPassword();
      return TTV.auth.makeCredentials(password).then(function (cred) {
        return TTV.Store.get('vendors', row.id).then(function (fresh) { // đọc lại ngay trước khi ghi
          if (!fresh) throw notFoundVendor();
          return TTV.Store.put('vendors', Object.assign({}, fresh, cred, { must_change_pw: true, updated_at: new Date().toISOString() }));
        });
      }).then(function (saved) {
        return Promise.all([dropAccountSessions('vendor', saved.id), TTV.Store.remove('__meta', failKey(String(saved.username).toLowerCase()))]).then(function () {
          return auditSafe('vendor.reset_password', { target_table: 'vendors', target_id: saved.id, detail: { username: saved.username } }); // không ghi mật khẩu
        }).then(function () { return { vendor: publicVendor(saved), username: saved.username, password: password }; });
      });
    });
  };

  // Sửa thông tin (không đổi tên đăng nhập, không đụng mật khẩu / ví / đánh giá). Trả { vendor, changed:[tên trường] }.
  var EDIT_FIELDS = ['type', 'name', 'phone', 'email', 'team_size', 'services', 'areas', 'vehicle', 'commission_rate'];
  var EDIT_HIDDEN = ['phone', 'email']; // thay đổi được ghi nhận nhưng không lưu giá trị vào audit_logs
  api.updateVendor = function (id, data) {
    var err = adminGuard('Bạn không có quyền sửa thông tin thợ.');
    if (err) return Promise.reject(err);
    var res = api.validateVendorInput(data, { account: false });
    return Promise.all([TTV.Store.list('services'), vendorConflicts(res.value, String(id))]).then(function (r) {
      var codes = r[0].map(function (x) { return x.code || x.id; });
      if (!res.errors.services && res.value.services.some(function (c) { return codes.indexOf(c) < 0; })) res.errors.services = 'Có dịch vụ không hợp lệ.';
      Object.keys(r[1]).forEach(function (k) { if (!res.errors[k]) res.errors[k] = r[1][k]; });
      if (Object.keys(res.errors).length) throw fail('VALIDATION', 'Vui lòng kiểm tra lại các trường được đánh dấu.', { errors: res.errors });
      return TTV.Store.get('vendors', String(id));
    }).then(function (fresh) {
      if (!fresh) throw notFoundVendor();
      return vendorConflicts(res.value, fresh.id).then(function (errs) { // đọc lại ngay trước khi ghi
        if (Object.keys(errs).length) throw fail('VALIDATION', 'Vui lòng kiểm tra lại các trường được đánh dấu.', { errors: errs });
        var v = res.value, next = {}, changed = [], changes = {};
        EDIT_FIELDS.forEach(function (k) {
          next[k] = v[k];
          if (JSON.stringify(fresh[k] == null ? null : fresh[k]) !== JSON.stringify(v[k] == null ? null : v[k])) {
            changed.push(k);
            if (EDIT_HIDDEN.indexOf(k) < 0) changes[k] = { from: fresh[k] == null ? null : fresh[k], to: v[k] };
          }
        });
        if (!changed.length) return { vendor: publicVendor(fresh), changed: [] };
        return TTV.Store.put('vendors', Object.assign({}, fresh, next, { updated_at: new Date().toISOString() })).then(function (saved) {
          return auditSafe('vendor.update', { target_table: 'vendors', target_id: saved.id, detail: { username: saved.username, fields: changed, changes: changes } })
            .then(function () { return { vendor: publicVendor(saved), changed: changed }; });
        });
      });
    });
  };
  /* ===================== 3.6 Cấu hình giá và hệ thống (admin) ===================== */
  var CFG_DEFAULTS = { commission_default: 15, demo_quote_bot_enabled: true, vendor_wallet_negative_limit: -500000, hotline: '', support_email: '', zalo_url: '', quick_topup_amounts: [50000, 100000, 200000, 500000, 1000000, 2000000], topup_fee: 0 };
  var CFG_KEYS = Object.keys(CFG_DEFAULTS);
  function fmtVnd(n) { return new Intl.NumberFormat('vi-VN').format(n); }
  // Số tiền nguyên: nhận "100000", "100.000", "100,000", "100 000", "100.000đ". Trả số nguyên hoặc null.
  api.parseMoneyInput = function (raw) {
    var x = String(raw == null ? '' : raw).trim().replace(/đ$/i, '').trim();
    if (!x || !/^[\d.,\s]+$/.test(x)) return null;
    var digits = x.replace(/[.,\s]/g, '');
    return /^\d{1,12}$/.test(digits) ? Number(digits) : null;
  };
  // Số thập phân tối đa 2 chữ số, dấu phẩy hoặc dấu chấm: "1,25" / "1.25" / "70". Trả số hoặc null.
  function parseDecimalInput(raw) {
    var x = String(raw == null ? '' : raw).trim().replace(',', '.');
    return /^\d{1,6}(\.\d{1,2})?$/.test(x) ? Number(x) : null;
  }
  function cfgMoney(data, key, min, max, errors) {
    var raw = data[key], n = api.parseMoneyInput(raw);
    if (String(raw == null ? '' : raw).trim() === '') { errors[key] = 'Vui lòng nhập số tiền.'; return null; }
    if (n == null) { errors[key] = 'Chỉ nhập số (ví dụ 100.000).'; return null; }
    if (n < min || n > max) { errors[key] = 'Nhập từ ' + fmtVnd(min) + 'đ đến ' + fmtVnd(max) + 'đ.'; return null; }
    return n;
  }
  function cfgDecimal(data, key, min, max, unit, errors) {
    var raw = data[key];
    if (String(raw == null ? '' : raw).trim() === '') { errors[key] = 'Vui lòng nhập giá trị.'; return null; }
    var n = parseDecimalInput(raw);
    if (n == null) { errors[key] = 'Chỉ nhập số, tối đa 2 chữ số thập phân.'; return null; }
    if (n < min || n > max) { errors[key] = 'Nhập từ ' + String(min).replace('.', ',') + ' đến ' + String(max).replace('.', ',') + unit + '.'; return null; }
    return n;
  }
  function cfgInt(data, key, min, max, unit, errors) {
    var raw = String(data[key] == null ? '' : data[key]).trim();
    if (!raw) { errors[key] = 'Vui lòng nhập giá trị.'; return null; }
    if (!/^\d{1,6}$/.test(raw)) { errors[key] = 'Chỉ nhập số nguyên.'; return null; }
    var n = Number(raw);
    if (n < min || n > max) { errors[key] = 'Nhập từ ' + min + ' đến ' + max + unit + '.'; return null; }
    return n;
  }

  // Kiểm tra dữ liệu form (chuỗi người dùng nhập). Trả { errors:{khóa:thông báo}, value:{services,tiers,pricing,settings} }.
  // Khóa lỗi: svc_<mã dịch vụ>, tier_<mã mức>, floor_fee, elevator_pct, km_fee, speed_fast, speed_urgent, min_amount, quote_window_min,
  //           commission_default, wallet_negative_limit, hotline, support_email, zalo_url, topup_amounts, topup_fee.
  api.validateAdminConfig = function (data) {
    data = data || {};
    var errors = {}, value = { services: {}, tiers: {}, pricing: {}, settings: {} }, n;
    Object.keys(data.svc || {}).forEach(function (code) {
      var e = {}; n = cfgMoney({ v: data.svc[code] }, 'v', 0, 10000000, e);
      if (e.v) errors['svc_' + code] = e.v; else value.services[code] = n;
    });
    Object.keys(data.tier || {}).forEach(function (code) {
      var e = {}; n = cfgMoney({ v: data.tier[code] }, 'v', 0, 10000000, e);
      if (e.v) errors['tier_' + code] = e.v; else value.tiers[code] = n;
    });
    var p = value.pricing;
    if ((n = cfgMoney(data, 'floor_fee', 0, 1000000, errors)) != null) p.floor_fee = n;
    if ((n = cfgDecimal(data, 'elevator_pct', 0, 100, ' %', errors)) != null) p.elevator_discount = Math.round(n * 100) / 10000; // 70 % → 0.7
    if ((n = cfgMoney(data, 'km_fee', 0, 1000000, errors)) != null) p.km_fee = n;
    var fast = cfgDecimal(data, 'speed_fast', 1, 10, '', errors), urgent = cfgDecimal(data, 'speed_urgent', 1, 10, '', errors);
    if (fast != null && urgent != null && urgent < fast) errors.speed_urgent = 'Hệ số Gấp phải lớn hơn hoặc bằng Nhanh.';
    if (fast != null && urgent != null && !errors.speed_urgent) p.speed_multipliers = { default: 1, fast: fast, urgent: urgent };
    if ((n = cfgMoney(data, 'min_amount', 1000, 10000000, errors)) != null) p.min_amount = n;
    if ((n = cfgInt(data, 'quote_window_min', 1, 1440, ' phút', errors)) != null) p.quote_window_min = n;

    var st = value.settings;
    if ((n = cfgDecimal(data, 'commission_default', 0, 100, ' %', errors)) != null) st.commission_default = n;
    st.demo_quote_bot_enabled = !!data.bot_enabled;
    if ((n = cfgMoney(data, 'wallet_negative_limit', 0, 100000000, errors)) != null) st.vendor_wallet_negative_limit = n === 0 ? 0 : -n; // nhập số dương, lưu số âm
    var hot = String(data.hotline == null ? '' : data.hotline).trim().replace(/\s+/g, ' '), hd = hot.replace(/\D/g, '');
    if (!hot) errors.hotline = 'Vui lòng nhập hotline.';
    else if (hot.length > 20 || !/^[0-9 .+\-()]+$/.test(hot) || hd.length < 8 || hd.length > 15) errors.hotline = 'Hotline gồm 8–15 chữ số (ví dụ 1900 0000).';
    else st.hotline = hot;
    var mail = String(data.support_email == null ? '' : data.support_email).trim();
    if (!mail) errors.support_email = 'Vui lòng nhập email hỗ trợ.';
    else if (mail.length > 120 || !api.isValidEmail(mail)) errors.support_email = 'Email không hợp lệ.';
    else st.support_email = mail;
    var zalo = String(data.zalo_url == null ? '' : data.zalo_url).trim(), zurl = null;
    if (!zalo) errors.zalo_url = 'Vui lòng nhập link Zalo.';
    else {
      try { zurl = new URL(zalo); } catch (_) { zurl = null; }
      if (zalo.length > 200 || !zurl || zurl.protocol !== 'https:' || zurl.hostname.indexOf('.') < 0) errors.zalo_url = 'Link phải bắt đầu bằng https:// (ví dụ https://zalo.me).';
      else st.zalo_url = zalo;
    }
    var amounts = (Array.isArray(data.topup_amounts) ? data.topup_amounts : []).map(function (a) { return typeof a === 'number' ? a : api.parseMoneyInput(a); });
    if (!amounts.length) errors.topup_amounts = 'Cần ít nhất 1 mức nạp nhanh.';
    else if (amounts.length > 9) errors.topup_amounts = 'Tối đa 9 mức nạp nhanh.';
    else if (amounts.some(function (a) { return a == null || a < 10000 || a > 50000000; })) errors.topup_amounts = 'Mỗi mức từ 10.000đ đến 50.000.000đ.';
    else if (amounts.some(function (a, i) { return amounts.indexOf(a) !== i; })) errors.topup_amounts = 'Các mức nạp nhanh không được trùng nhau.';
    else st.quick_topup_amounts = amounts.slice().sort(function (a, b) { return a - b; });
    if ((n = cfgMoney(data, 'topup_fee', 0, 1000000, errors)) != null) st.topup_fee = n;
    return { errors: errors, value: value };
  };

  // Đọc toàn bộ cấu hình để hiển thị: { services:[{code,name,icon,base_price}], tiers:[{code,name,description,price}], pricing:{…}, settings:{…} }.
  api.getAdminConfig = function () {
    var err = adminGuard('Bạn không có quyền xem cấu hình hệ thống.');
    if (err) return Promise.reject(err);
    return Promise.all([TTV.Store.list('services'), TTV.Store.get('pricing_config', 'default'), TTV.Store.list('app_settings')]).then(function (r) {
      var row = r[1];
      if (!row) throw fail('NOT_FOUND', 'Chưa có cấu hình giá. Hãy xóa dữ liệu trình duyệt và tải lại để nạp dữ liệu mẫu.');
      var order = ['moving', 'warehouse', 'furniture', 'office', 'construction', 'hourly', 'goods'];
      var services = (r[0] || []).map(function (x) { return { code: x.code || x.id, name: x.name, icon: x.icon || '', base_price: Number(x.base_price) || 0 }; })
        .sort(function (a, b) { var ia = order.indexOf(a.code), ib = order.indexOf(b.code); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      var tiers = (row.weight_tiers || []).map(function (x) { return { code: x.code || x.id, name: x.name, description: x.description || '', price: Number(x.price) || 0 }; });
      var sm = row.speed_multipliers || {};
      var pricing = { floor_fee: Number(row.floor_fee) || 0, elevator_discount: row.elevator_discount == null ? 0.7 : Number(row.elevator_discount), km_fee: Number(row.km_fee) || 0,
        speed_multipliers: { default: 1, fast: Number(sm.fast) || 1.25, urgent: Number(sm.urgent) || 1.5 }, min_amount: Number(row.min_amount) || 10000, quote_window_min: Number(row.quote_window_min) || 30 };
      var settings = {};
      CFG_KEYS.forEach(function (k) {
        var hit = (r[2] || []).filter(function (x) { return (x.key || x.id) === k; })[0];
        settings[k] = hit && hit.value != null ? hit.value : CFG_DEFAULTS[k];
      });
      return { services: services, tiers: tiers, pricing: pricing, settings: settings };
    });
  };

  // Lưu cấu hình. Chỉ ghi các bản ghi thật sự đổi; đọc lại ngay trước khi ghi; ghi audit_logs theo nhóm. Trả { changed:[nhóm], config }.
  api.saveAdminConfig = function (data) {
    var err = adminGuard('Bạn không có quyền sửa cấu hình hệ thống.');
    if (err) return Promise.reject(err);
    var res = api.validateAdminConfig(data);
    return Promise.all([TTV.Store.list('services'), TTV.Store.get('pricing_config', 'default'), TTV.Store.list('app_settings')]).then(function (r) {
      var services = r[0] || [], row = r[1], settingRows = r[2] || [];
      if (!row) throw fail('NOT_FOUND', 'Chưa có cấu hình giá. Hãy xóa dữ liệu trình duyệt và tải lại để nạp dữ liệu mẫu.');
      var codes = services.map(function (x) { return x.code || x.id; }), tierCodes = (row.weight_tiers || []).map(function (x) { return x.code || x.id; });
      Object.keys((data && data.svc) || {}).forEach(function (c) { if (codes.indexOf(c) < 0) res.errors['svc_' + c] = 'Dịch vụ không tồn tại.'; });
      Object.keys((data && data.tier) || {}).forEach(function (c) { if (tierCodes.indexOf(c) < 0) res.errors['tier_' + c] = 'Mức trọng lượng không tồn tại.'; });
      if (Object.keys(res.errors).length) throw fail('VALIDATION', 'Vui lòng kiểm tra lại các trường được đánh dấu.', { errors: res.errors });
      var v = res.value, now = new Date().toISOString(), changed = [], writes = [];

      // 1) Giá cơ bản dịch vụ
      var svcChanges = {};
      services.forEach(function (x) {
        var code = x.code || x.id;
        if (v.services[code] != null && Number(x.base_price) !== v.services[code]) {
          svcChanges[code] = { from: Number(x.base_price) || 0, to: v.services[code] };
          writes.push(function () { return TTV.Store.put('services', Object.assign({}, x, { base_price: v.services[code] })); });
        }
      });
      if (Object.keys(svcChanges).length) changed.push('services');

      // 2) pricing_config
      var pc = {}, nextRow = Object.assign({}, row), tierChanges = {};
      nextRow.weight_tiers = (row.weight_tiers || []).map(function (x) {
        var code = x.code || x.id;
        if (v.tiers[code] != null && Number(x.price) !== v.tiers[code]) { tierChanges[code] = { from: Number(x.price) || 0, to: v.tiers[code] }; return Object.assign({}, x, { price: v.tiers[code] }); }
        return x;
      });
      if (Object.keys(tierChanges).length) pc.weight_tiers = tierChanges;
      ['floor_fee', 'elevator_discount', 'km_fee', 'min_amount', 'quote_window_min'].forEach(function (k) {
        if (Number(row[k]) !== v.pricing[k]) { pc[k] = { from: row[k] == null ? null : row[k], to: v.pricing[k] }; nextRow[k] = v.pricing[k]; }
      });
      var oldSm = row.speed_multipliers || {}, newSm = v.pricing.speed_multipliers;
      ['fast', 'urgent'].forEach(function (k) { if (Number(oldSm[k]) !== newSm[k]) pc['speed_' + k] = { from: oldSm[k] == null ? null : oldSm[k], to: newSm[k] }; });
      if (Number(oldSm.default) !== 1 || pc.speed_fast || pc.speed_urgent) nextRow.speed_multipliers = newSm;
      if (Object.keys(pc).length) {
        nextRow.updated_at = now;
        writes.push(function () { return TTV.Store.put('pricing_config', nextRow); });
        changed.push('pricing');
      }

      // 3) app_settings
      var stChanges = {};
      CFG_KEYS.forEach(function (k) {
        var hit = settingRows.filter(function (x) { return (x.key || x.id) === k; })[0];
        var cur = hit && hit.value != null ? hit.value : CFG_DEFAULTS[k], next = v.settings[k];
        if (JSON.stringify(cur) !== JSON.stringify(next)) {
          stChanges[k] = { from: cur, to: next };
          writes.push(function () { return TTV.Store.put('app_settings', Object.assign({}, hit || {}, { id: k, key: k, value: next, updated_at: now })); });
        }
      });
      if (Object.keys(stChanges).length) changed.push('app');

      if (!changed.length) return { changed: [] };
      return writes.reduce(function (chain, w) { return chain.then(w); }, Promise.resolve()).then(function () {
        var logs = [];
        if (svcChanges && Object.keys(svcChanges).length) logs.push(auditSafe('settings.service_price.update', { target_table: 'services', target_id: 'base_price', detail: { changes: svcChanges } }));
        if (Object.keys(pc).length) logs.push(auditSafe('settings.pricing.update', { target_table: 'pricing_config', target_id: 'default', detail: { changes: pc } }));
        if (Object.keys(stChanges).length) logs.push(auditSafe('settings.app.update', { target_table: 'app_settings', target_id: Object.keys(stChanges).join(','), detail: { changes: stChanges } }));
        return Promise.all(logs);
      }).then(function () { return { changed: changed }; });
    }).then(function (res2) {
      return api.getAdminConfig().then(function (config) { return { changed: res2.changed, config: config }; });
    });
  };

  /* ===== 5.1 Khung app thợ: hồ sơ của chính thợ, công tắc Sẵn sàng nhận đơn, thống kê hôm nay ===== */
  // Ngưỡng ví âm mặc định (trùng seed). Đọc từ app_settings `vendor_wallet_negative_limit` (số âm) khi có.
  var VENDOR_WALLET_LIMIT_DEFAULT = -500000;
  function vendorSelfId() {
    var s = TTV.auth.getSession();
    return s && s.role === 'VENDOR' && s.account_type === 'vendor' ? String(s.account_id) : null;
  }
  function requireVendorSelf() {
    var id = vendorSelfId();
    return id ? Promise.resolve(id) : Promise.reject(fail('FORBIDDEN', 'Chỉ tài khoản thợ mới dùng được chức năng này.'));
  }
  function vendorWalletLimit() {
    return api.getSetting('vendor_wallet_negative_limit').then(function (v) {
      var n = (v === null || v === undefined || v === '') ? NaN : Number(v);
      return Number.isFinite(n) ? n : VENDOR_WALLET_LIMIT_DEFAULT;
    });
  }
  // Ví âm quá ngưỡng thì tạm khóa nhận đơn (mục 4 "Ví và tiền").
  function vendorWalletBlocked(row, limit) { return Number(row.wallet_balance || 0) < limit; }
  // Thời điểm hoàn thành đơn: ưu tiên `completed_at`, rồi mốc `completed` trong `timeline[]` (task 5.8 ghi một trong hai).
  function orderCompletedAt(o) {
    if (o.completed_at) return o.completed_at;
    var tl = Array.isArray(o.timeline) ? o.timeline : [];
    for (var i = tl.length - 1; i >= 0; i--) {
      var e = tl[i] || {};
      if (e.status === 'completed' || e.event === 'completed') return e.at || e.created_at || e.time || null;
    }
    return o.updated_at || null;
  }
  function localDayRange(now) {
    var from = new Date(now == null ? Date.now() : now); from.setHours(0, 0, 0, 0);
    var to = new Date(from.getTime()); to.setDate(to.getDate() + 1);
    return { from: from.getTime(), to: to.getTime() };
  }

  // Hồ sơ của chính thợ đang đăng nhập (không có salt/hash).
  api.getVendorSelf = function () {
    return requireVendorSelf().then(function (id) { return TTV.Store.get('vendors', id); }).then(function (row) {
      if (!row) throw notFoundVendor();
      return publicVendor(row);
    });
  };

  // Bật/tắt "Sẵn sàng nhận đơn". Đọc lại hồ sơ ngay trước khi ghi (KIO không có giao dịch);
  // tài khoản bị khóa thì chặn (code LOCKED); ví âm quá ngưỡng thì không cho bật (code WALLET_NEGATIVE).
  api.setVendorOnline = function (flag) {
    flag = !!flag;
    return requireVendorSelf().then(function (id) {
      return Promise.all([TTV.Store.get('vendors', id), vendorWalletLimit()]);
    }).then(function (parts) {
      var row = parts[0], limit = parts[1];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      if (flag && vendorWalletBlocked(row, limit)) {
        throw fail('WALLET_NEGATIVE', 'Số dư ví đang âm quá ' + fmtVnd(Math.abs(limit)) + 'đ nên tạm thời chưa bật nhận đơn được.', { limit: limit });
      }
      if (!!row.is_online === flag) return row; // đã đúng trạng thái, không ghi lại
      return TTV.Store.put('vendors', Object.assign({}, row, { is_online: flag, updated_at: new Date().toISOString() }));
    }).then(publicVendor);
  };

  // Dữ liệu trang chủ thợ: hồ sơ, trạng thái nhận đơn, thống kê hôm nay (giờ máy) và các con số đang diễn ra.
  //  today.completed / today.earnings : đơn `completed` của thợ có thời điểm hoàn thành trong hôm nay; earnings = tổng `vendor_earning`.
  //  ongoing.pendingQuotes            : báo giá `pending` mà đơn còn `finding`.
  //  ongoing.activeJobs               : đơn của thợ đang `matched` / `arriving` / `working`.
  //  readiness.online                 : đang bật VÀ ví chưa âm quá ngưỡng (nơi khác dùng để lọc thợ nhận đơn phải xét cả ví).
  api.getVendorDashboard = function () {
    var vid;
    return requireVendorSelf().then(function (id) {
      vid = id;
      return Promise.all([
        TTV.Store.get('vendors', id),
        TTV.Store.query('orders', function (o) { return String(o.vendor_id) === id; }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id && q.status === 'pending'; }),
        vendorWalletLimit()
      ]);
    }).then(function (parts) {
      var row = parts[0], orders = parts[1] || [], quotes = parts[2] || [], limit = parts[3];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      var range = localDayRange(), completed = 0, earnings = 0, activeJobs = 0;
      orders.forEach(function (o) {
        if (o.status === 'completed') {
          var ts = new Date(orderCompletedAt(o)).getTime();
          if (ts >= range.from && ts < range.to) { completed++; earnings += Number(o.vendor_earning) || 0; }
        } else if (o.status === 'matched' || o.status === 'arriving' || o.status === 'working') activeJobs++;
      });
      var orderIds = [];
      quotes.forEach(function (q) { var k = String(q.order_id); if (orderIds.indexOf(k) < 0) orderIds.push(k); });
      return Promise.all(orderIds.map(function (oid) { return TTV.Store.get('orders', oid); })).then(function (found) {
        var open = {};
        found.forEach(function (o) { if (o && o.status === 'finding') open[String(o.id)] = true; });
        var pendingQuotes = quotes.filter(function (q) { return open[String(q.order_id)]; }).length;
        var blocked = vendorWalletBlocked(row, limit);
        return {
          vendor: publicVendor(row),
          today: { date: new Date(range.from).toISOString(), completed: completed, earnings: earnings },
          ongoing: { pendingQuotes: pendingQuotes, activeJobs: activeJobs },
          readiness: { online: !!row.is_online && !blocked, blocked: blocked, limit: limit }
        };
      });
    });
  };

  /* ===== 5.2 Chợ đơn + 5.3 Chi tiết đơn (thợ) ===== */
  // Sắp xếp chợ đơn: mới nhất / gấp nhất / gần nhất (gần = quãng đường điểm bốc → điểm trả ngắn nhất, vì chưa có vị trí của thợ).
  api.MARKET_SORTS = ['newest', 'urgent', 'nearest'];
  var SPEED_RANK = { urgent: 0, fast: 1, default: 2, custom: 2 };
  var WEIGHT_FALLBACK = { light: 'Nhẹ', medium: 'Vừa', heavy: 'Nặng', very_heavy: 'Rất nặng' };
  var ACTIVE_JOB = { matched: 1, arriving: 1, working: 1, completed: 1 };

  // Bỏ dấu + chữ thường để so khớp địa chỉ với khu vực của thợ.
  function foldText(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  }
  // Khu vực của thợ khớp với ĐIỂM BỐC: "Toàn TP.HCM" khớp mọi đơn; quận số (Quận 1) không nhầm với Quận 10/12.
  function areaMatches(areas, addr) {
    areas = Array.isArray(areas) ? areas : [];
    if (!areas.length) return false;
    if (areas.indexOf(api.VENDOR_CITY_AREA) >= 0) return true;
    var text = foldText(addr);
    if (!text) return false;
    return areas.some(function (a) {
      var f = foldText(a), m = /^quan (\d+)$/.exec(f);
      if (m) return new RegExp('(^|[^0-9a-z])(quan|q\\.?|district)\\s*' + m[1] + '(?![0-9])').test(text);
      f = f.replace(/^(tp\.?|thanh pho|huyen|quan)\s+/, '');
      return !!f && text.indexOf(f) >= 0;
    });
  }
  // Điểm bốc/trả: đọc dạng {addr,lat,lng} (mục 5); chấp nhận thêm chuỗi + `<key>_lat/_lng` phòng khi 4.9 lưu kiểu khác.
  function placeOf(o, key) {
    var p = o[key];
    if (p && typeof p === 'object') return { addr: String(p.addr || p.address || ''), lat: p.lat != null ? Number(p.lat) : null, lng: p.lng != null ? Number(p.lng) : null };
    return { addr: String(p || ''), lat: o[key + '_lat'] != null ? Number(o[key + '_lat']) : null, lng: o[key + '_lng'] != null ? Number(o[key + '_lng']) : null };
  }
  function createdMs(o) { var t = new Date(o.created_at).getTime(); return Number.isFinite(t) ? t : 0; }
  function deadlineMs(o, windowMin) {
    var d = o.quote_deadline ? new Date(o.quote_deadline).getTime() : NaN;
    return Number.isFinite(d) ? d : createdMs(o) + (Number(windowMin) || 30) * 60000;
  }
  // Số tiền khách trả đang hiệu lực. Đơn Gấp "tăng dần theo thời gian": công thức chờ 4.4; hiện lấy `current_offer` nếu có, không thì `user_offer`.
  api.currentOffer = function (o) {
    var cur = Number(o && o.current_offer), base = Number(o && o.user_offer);
    return (o && o.speed === 'urgent' && Number.isFinite(cur) && cur > 0) ? cur : (Number.isFinite(base) ? base : 0);
  };
  // Đơn có khớp hồ sơ thợ không (mục 4 "Báo giá (thợ)"): loại nhà cung cấp, số thợ ≤ quy mô đội, dịch vụ, khu vực.
  function orderFitsVendor(o, v) {
    var provider = o.provider_type || 'any', workers = Math.max(1, Number(o.workers) || 1);
    if (provider !== 'any' && provider !== 'all' && provider !== v.type) return false;
    if (workers > Math.max(1, Number(v.team_size) || 1)) return false;
    if (workers >= 2 && v.type === 'personal') return false;
    if (!Array.isArray(v.services) || v.services.indexOf(o.service) < 0) return false;
    return areaMatches(v.areas, placeOf(o, 'pickup').addr);
  }
  function marketView(o, env) {
    var pickup = placeOf(o, 'pickup'), drop = placeOf(o, 'dropoff'), workers = Math.max(1, Number(o.workers) || 1);
    var sv = env.services[o.service] || {}, wt = env.weights[o.weight_tier] || {};
    var dl = deadlineMs(o, env.windowMin), q = env.quotes[String(o.id)] || null;
    return {
      id: String(o.id), code: TTV.Utils.orderCode(o.id), status: o.status, created_at: o.created_at,
      service: o.service, service_name: sv.name || o.service || '', service_icon: sv.icon || '📦',
      speed: o.speed || 'default', provider_type: o.provider_type || 'any', pay_method: o.pay_method || 'cash',
      pickup: pickup, dropoff: drop, distance_km: Number(o.distance_km) || 0,
      weight_tier: o.weight_tier || '', weight_name: wt.name || WEIGHT_FALLBACK[o.weight_tier] || '', weight_hint: wt.description || '',
      pickup_floor: Number(o.pickup_floor) || 0, pickup_elevator: !!o.pickup_elevator,
      need_unload: o.need_unload !== false, drop_floor: Number(o.drop_floor) || 0, drop_elevator: !!o.drop_elevator,
      workers: workers, note: String(o.note || ''), mode: workers >= 2 ? 'fixed' : 'bid',
      user_offer: Number(o.user_offer) || 0, offer: api.currentOffer(o), price_breakdown: o.price_breakdown || null,
      deadline: dl, remaining_ms: dl - env.now,
      my_quote: q ? { id: q.id, status: q.status, price: Number(q.price) || 0 } : null
    };
  }
  function marketEnv(windowCfg, services, quotes) {
    var svMap = {}; (services || []).forEach(function (s) { svMap[s.code || s.id] = s; });
    var wMap = {}; ((windowCfg && windowCfg.weight_tiers) || []).forEach(function (w) { wMap[w.id || w.code] = w; });
    var qMap = {};
    (quotes || []).forEach(function (q) { // mỗi thợ 1 báo giá hiệu lực/đơn: ưu tiên bản chưa rút, mới nhất
      var k = String(q.order_id), prev = qMap[k];
      if (q.status === 'withdrawn' && prev) return;
      if (!prev || prev.status === 'withdrawn' || String(q.created_at || '') >= String(prev.created_at || '')) qMap[k] = q;
    });
    return { services: svMap, weights: wMap, quotes: qMap, windowMin: Number(windowCfg && windowCfg.quote_window_min) || 30, now: Date.now() };
  }
  api.sortMarketOrders = function (list, sort) {
    var arr = (list || []).slice();
    var newest = function (a, b) { return createdMs(b) - createdMs(a); };
    arr.sort(function (a, b) {
      var ca = new Date(a.created_at).getTime() || 0, cb = new Date(b.created_at).getTime() || 0;
      if (sort === 'urgent') {
        var d = (SPEED_RANK[a.speed] != null ? SPEED_RANK[a.speed] : 2) - (SPEED_RANK[b.speed] != null ? SPEED_RANK[b.speed] : 2);
        return d || (cb - ca);
      }
      if (sort === 'nearest') {
        var ka = a.distance_km > 0 ? a.distance_km : Infinity, kb = b.distance_km > 0 ? b.distance_km : Infinity;
        if (ka !== kb) return ka < kb ? -1 : 1;
        return cb - ca;
      }
      return cb - ca;
    });
    return arr;
  };

  // Chợ đơn: đơn `finding` còn hạn, khớp hồ sơ thợ. Thợ đang tắt "Sẵn sàng nhận đơn" hoặc ví âm quá ngưỡng thì không thấy đơn nào (ready=false).
  api.listMarketOrders = function (opts) {
    opts = opts || {};
    var vid;
    return requireVendorSelf().then(function (id) {
      vid = id;
      return Promise.all([
        TTV.Store.get('vendors', id), vendorWalletLimit(),
        TTV.Store.query('orders', function (o) { return o.status === 'finding'; }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id; }),
        api.listServices(), TTV.Store.get('pricing_config', 'default')
      ]);
    }).then(function (p) {
      var row = p[0], limit = p[1], orders = p[2] || [];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      var blocked = vendorWalletBlocked(row, limit), ready = !!row.is_online && !blocked;
      var env = marketEnv(p[5], p[4], p[3]), list = [];
      if (ready) {
        orders.forEach(function (o) {
          if (deadlineMs(o, env.windowMin) <= env.now) return; // hết hạn nhận báo giá (6.6 sẽ tự hủy)
          if (!orderFitsVendor(o, row)) return;
          list.push(marketView(o, env));
        });
      }
      return { vendor: publicVendor(row), readiness: { online: !!row.is_online, blocked: blocked, ready: ready, limit: limit }, orders: api.sortMarketOrders(list, opts.sort || 'newest'), now: env.now };
    });
  };

  // Chi tiết đơn cho thợ. Xem được khi: đơn của chính thợ, thợ đã có báo giá cho đơn, hoặc đơn `finding` còn hạn và khớp hồ sơ.
  // SĐT khách chỉ trả về khi thợ đã được ghép (matched trở đi). Mã lỗi: ORDER_NOT_FOUND / UNAVAILABLE / NOT_ELIGIBLE.
  api.getMarketOrder = function (orderId) {
    var vid, oid = String(orderId || '');
    return requireVendorSelf().then(function (id) {
      vid = id;
      return Promise.all([
        TTV.Store.get('vendors', id), vendorWalletLimit(), TTV.Store.get('orders', oid),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id && String(q.order_id) === oid; }),
        TTV.Store.query('order_media', function (m) { return String(m.order_id) === oid; }),
        api.listServices(), TTV.Store.get('pricing_config', 'default')
      ]);
    }).then(function (p) {
      var row = p[0], limit = p[1], o = p[2];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      if (!o) throw fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn này.');
      var env = marketEnv(p[6], p[5], p[3]);
      var mine = String(o.vendor_id || '') === vid, hasQuote = (p[3] || []).length > 0;
      var open = o.status === 'finding' && deadlineMs(o, env.windowMin) > env.now;
      var fits = orderFitsVendor(o, row);
      if (!mine && !hasQuote && !(open && fits)) {
        if (!open) throw fail('UNAVAILABLE', 'Đơn này không còn nhận báo giá.');
        throw fail('NOT_ELIGIBLE', 'Đơn này không phù hợp với dịch vụ, khu vực hoặc quy mô đội của bạn.');
      }
      var view = marketView(o, env);
      view.is_mine = mine;
      view.can_act = open && fits && !!row.is_online && !vendorWalletBlocked(row, limit); // 5.4 / 5.5 dùng để bật nút Báo giá / Nhận đơn
      view.action = view.can_act ? (view.mode === 'fixed' ? 'accept' : 'quote') : null;
      view.media = (p[4] || []).map(function (m) { return { id: String(m.id), kind: m.kind === 'video' ? 'video' : 'image', path: String(m.path || ''), duration: Number(m.duration) || 0 }; })
        .filter(function (m) { return m.path; })
        .sort(function (a, b) { return (a.kind === b.kind ? 0 : a.kind === 'image' ? -1 : 1); });
      view.customer = null;
      if (mine && ACTIVE_JOB[o.status] && o.user_id) {
        return TTV.Store.get('users', o.user_id).then(function (u) {
          if (u) view.customer = { name: u.name || '', phone: u.phone || '' };
          return view;
        });
      }
      return view;
    });
  };
})(window.TTV);
