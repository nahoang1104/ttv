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
        if (user && user.status === 'locked') { writeChallenge(null); throw fail('ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.'); }
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
      if (existing && existing.status === 'locked') throw fail('ACCOUNT_LOCKED', 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.');
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
  var POLICY_TYPES = ['terms', 'privacy', 'refund'];
  function parsePolicyContent(text) {
    var raw = String(text || '').trim();
    if (!raw) return [];
    return raw.split(/\n(?=\d+\.\s)/).map(function (block) {
      var lines = block.trim().split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!lines.length) return null;
      if (/^\d+\.\s/.test(lines[0])) return { title: lines[0], paras: lines.slice(1) };
      return { title: '', paras: lines };
    }).filter(Boolean);
  }
  function hydratePolicy(row) {
    if (!row) return null;
    return {
      id: row.id,
      type: row.type || row.id,
      title: row.title || '',
      content: row.content || '',
      sections: parsePolicyContent(row.content),
      updated_at: row.updated_at || ''
    };
  }
  api.getPolicy = function (type) {
    return TTV.Store.get('policies', String(type || '')).then(hydratePolicy);
  };
  api.savePolicy = function (input) {
    var s = TTV.auth.getSession();
    if (!s || s.role !== 'SUPER_ADMIN') return Promise.reject(fail('FORBIDDEN', 'Bạn không có quyền sửa điều khoản.'));
    var type = String((input && input.type) || '');
    if (POLICY_TYPES.indexOf(type) < 0) return Promise.reject(fail('VALIDATION', 'Loại chính sách không hợp lệ.'));
    var content = String((input && input.content) || '').trim();
    if (!content) return Promise.reject(fail('VALIDATION', 'Nội dung không được để trống.', { errors: { content: 'Nội dung không được để trống.' } }));
    var title = String((input && input.title) || '').trim();
    return TTV.Store.get('policies', type).then(function (cur) {
      var next = {
        id: type,
        type: type,
        title: title || (cur && cur.title) || type,
        content: content,
        updated_at: new Date().toISOString()
      };
      return TTV.Store.put('policies', next);
    }).then(function (saved) {
      return TTV.Utils.audit('settings.policy.update', { target_table: 'policies', target_id: type, detail: { type: type, title: saved.title } }).catch(function () {}).then(function () {
        return hydratePolicy(saved);
      });
    });
  };
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
  api.listMyOrders = function () {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    return TTV.Store.query('orders', { user_id: s.account_id }).then(function (rows) {
      var finding = (rows || []).filter(function (o) { return o.status === 'finding'; });
      return Promise.all(finding.map(function (o) { return api.expireFindingIfNeeded(o.id); })).then(function () {
        return TTV.Store.query('orders', { user_id: s.account_id });
      });
    }).then(function (rows) {
      return (rows || []).slice().sort(function (a, b) {
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
    });
  };

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

  function notiInbox() {
    var s = TTV.auth && TTV.auth.getSession && TTV.auth.getSession();
    if (!s || !s.account_id) return null;
    var type = s.account_type === 'vendor' ? 'vendor' : (s.account_type === 'staff' ? 'staff' : 'customer');
    return { type: type, id: String(s.account_id) };
  }
  function isMyNotification(row, box) {
    if (!row || !box) return false;
    if (String(row.recipient_id || '') !== box.id) return false;
    return (row.recipient_type || 'customer') === box.type;
  }
  function pingLive(topic) {
    if (TTV.Live && typeof TTV.Live.ping === 'function') TTV.Live.ping(topic);
  }
  function background(p) {
    if (p && typeof p.then === 'function') p.catch(function () {});
  }
  function defaultNotiHref(type, orderId, event) {
    if (type === 'staff') return '/admin';
    if (type === 'vendor') {
      if (orderId && (event === 'quote.accepted' || event === 'order.new' || event === 'order.cancelled' || event === 'order.completed')) {
        return '/vendor/market/' + orderId;
      }
      return '/vendor/market';
    }
    if (!orderId) return '';
    if (event === 'quote.new' || event === 'order.created') return '/orders/' + orderId + '/quotes';
    return '/orders/' + orderId;
  }
  api.notificationHref = function (row) {
    if (!row) return '';
    if (row.href) return row.href;
    return defaultNotiHref(row.recipient_type || 'customer', row.order_id, row.event);
  };
  // Ghi 1 dòng / (event + đơn + người nhận) khi chưa đọc.
  api.pushNotification = function (input) {
    input = input || {};
    if (!input.recipient_id) return Promise.resolve([]);
    var t = {
      type: input.recipient_type || 'customer',
      id: String(input.recipient_id)
    };
    var now = new Date().toISOString();
    var key = input.event ? [input.event, input.order_id || '', t.type, t.id].join(':') : '';
    var findPrev = key
      ? store().query('notifications', function (r) {
        return r.dedupe_key === key && !r.is_read && String(r.recipient_id) === t.id && (r.recipient_type || 'customer') === t.type;
      }).then(function (rows) { return (rows && rows[0]) || null; })
      : Promise.resolve(null);
    return findPrev.then(function (prev) {
      var row = prev ? Object.assign({}, prev) : {
        id: TTV.Utils.id(),
        is_read: false,
        recipient_type: t.type,
        recipient_id: t.id
      };
      row.category = input.category || 'order';
      row.title = input.title || '';
      row.body = input.body || '';
      row.order_id = input.order_id ? String(input.order_id) : '';
      row.event = input.event || '';
      row.href = input.href || defaultNotiHref(t.type, input.order_id, input.event);
      row.dedupe_key = key;
      row.created_at = now;
      row.updated_at = now;
      return store().put('notifications', row);
    }).then(function (saved) {
      if (!input.silent) pingLive('noti');
      return saved;
    });
  };
  function notiSettingsDefaults() {
    return { order: true, promo: true, system: true, sound_vibrate: true };
  }
  function notiSettingsId(box) {
    return 'ns:' + box.type + ':' + box.id;
  }
  api.getNotificationSettings = function () {
    var box = notiInbox();
    if (!box) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var id = notiSettingsId(box);
    return store().get('notification_settings', id).then(function (row) {
      return Object.assign({ id: id, user_id: box.id, recipient_type: box.type }, notiSettingsDefaults(), row || {});
    });
  };
  api.saveNotificationSettings = function (patch) {
    patch = patch || {};
    return api.getNotificationSettings().then(function (cur) {
      var next = Object.assign({}, cur);
      ['order', 'promo', 'system', 'sound_vibrate'].forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = !!patch[k];
      });
      next.updated_at = new Date().toISOString();
      return store().put('notification_settings', next);
    }).then(function (saved) {
      if (TTV.NotiLive && TTV.NotiLive.setSoundEnabled) TTV.NotiLive.setSoundEnabled(!!saved.sound_vibrate);
      return saved;
    });
  };
  api.listMyNotifications = function (opts) {
    var box = notiInbox();
    if (!box) return Promise.resolve([]);
    return store().query('notifications', function (r) { return isMyNotification(r, box); }, opts || {}).then(function (rows) {
      return (rows || []).sort(function (a, b) {
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
    });
  };
  api.markNotificationRead = function (id) {
    var box = notiInbox();
    if (!box) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    return store().get('notifications', id).then(function (row) {
      if (!row || !isMyNotification(row, box)) throw fail('NOT_FOUND', 'Không tìm thấy thông báo.');
      if (row.is_read) return row;
      return store().put('notifications', Object.assign({}, row, { is_read: true })).then(function (saved) {
        pingLive('noti');
        return saved;
      });
    });
  };
  api.markAllNotificationsRead = function () {
    var box = notiInbox();
    if (!box) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    return api.listMyNotifications().then(function (rows) {
      return rows.filter(function (r) { return !r.is_read; }).reduce(function (chain, row) {
        return chain.then(function () {
          return store().put('notifications', Object.assign({}, row, { is_read: true }));
        });
      }, Promise.resolve()).then(function () { pingLive('noti'); });
    });
  };
  api.deleteNotification = function (id) {
    var box = notiInbox();
    if (!box) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    return store().get('notifications', id).then(function (row) {
      if (!row || !isMyNotification(row, box)) throw fail('NOT_FOUND', 'Không tìm thấy thông báo.');
      return store().remove('notifications', id).then(function () { pingLive('noti'); });
    });
  };

  function addressRole(row) {
    if (!row) return '';
    if (row.default_for === 'pickup' || row.default_for === 'dropoff') return row.default_for;
    if (row.is_default) return 'pickup';
    return '';
  }

  function applyRole(row, role) {
    row.default_for = role === 'pickup' || role === 'dropoff' ? role : '';
    delete row.is_default;
    return row;
  }

  function sortAddresses(rows) {
    var rank = { pickup: 0, dropoff: 1 };
    return (rows || []).slice().sort(function (a, b) {
      var ra = rank[a.default_for];
      var rb = rank[b.default_for];
      if (ra == null) ra = 2;
      if (rb == null) rb = 2;
      if (ra !== rb) return ra - rb;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  function loadUserAddresses() {
    var s = customerSession();
    if (!s) return Promise.resolve([]);
    return store().query('addresses', { user_id: s.account_id }).then(function (rows) {
      var ops = [];
      (rows || []).forEach(function (row) {
        var legacy = Object.prototype.hasOwnProperty.call(row, 'is_default');
        applyRole(row, addressRole(row));
        if (legacy) ops.push(store().put('addresses', row));
      });
      return Promise.all(ops).then(function () { return sortAddresses(rows || []); });
    });
  }

  api.listAddresses = function () {
    return loadUserAddresses();
  };

  api.getAddress = function (id) {
    var s = customerSession();
    if (!s) return Promise.resolve(null);
    return store().get('addresses', id).then(function (row) {
      if (!row || row.user_id !== s.account_id) return null;
      return applyRole(row, addressRole(row));
    });
  };

  api.saveAddress = function (payload) {
    payload = payload || {};
    var s = customerSession();
    if (!s) return Promise.reject(new Error('Hãy đăng nhập để lưu địa chỉ.'));
    var now = new Date().toISOString();
    var role = payload.default_for === 'dropoff' ? 'dropoff' : (payload.default_for === 'pickup' ? 'pickup' : '');
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
      default_for: role,
      created_at: payload.created_at || now,
      updated_at: now
    };
    if (!row.label || !row.detail) return Promise.reject(new Error('Nhập tên gợi nhớ và địa chỉ chi tiết.'));
    return loadUserAddresses().then(function (rows) {
      var existing = rows.filter(function (item) { return item.id === row.id; })[0];
      if (existing && existing.created_at) row.created_at = existing.created_at;
      var ops = rows.filter(function (item) {
        return item.id !== row.id && item.default_for === role && role;
      }).map(function (item) {
        applyRole(item, '');
        return store().put('addresses', item);
      });
      ops.push(store().put('addresses', row));
      return Promise.all(ops).then(function () { return row; });
    });
  };

  api.deleteAddress = function (id) {
    var s = customerSession();
    if (!s) return Promise.reject(new Error('Hãy đăng nhập để xóa địa chỉ.'));
    return store().get('addresses', id).then(function (row) {
      if (!row || row.user_id !== s.account_id) throw new Error('Không tìm thấy địa chỉ.');
      return store().remove('addresses', id);
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
        speed_multipliers: { default: 1, fast: Number(sm.fast) || 0, urgent: Number(sm.urgent) || 0 }, min_amount: Number(row.min_amount) || 0, quote_window_min: Number(row.quote_window_min) || 0 };
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
      }).then(function () {
        if (TTV.pricing && TTV.pricing.invalidate) TTV.pricing.invalidate();
        return { changed: changed };
      });
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
        TTV.Store.query('orders', function (o) { return String(o.vendor_id) === id || o.status === 'finding'; }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id && q.status === 'pending'; }),
        vendorWalletLimit()
      ]);
    }).then(function (parts) {
      var row = parts[0], orders = parts[1] || [], quotes = parts[2] || [], limit = parts[3];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      var range = localDayRange(), completed = 0, earnings = 0, activeJobs = 0, busyN = 0;
      var open = {};
      orders.forEach(function (o) {
        if (o.status === 'finding') open[String(o.id)] = true;
        if (String(o.vendor_id) !== vid) return;
        if (o.status === 'completed') {
          var ts = new Date(orderCompletedAt(o)).getTime();
          if (ts >= range.from && ts < range.to) { completed++; earnings += Number(o.vendor_earning) || 0; }
        } else if (o.status === 'matched' || o.status === 'arriving' || o.status === 'working') {
          activeJobs++;
          busyN += jobWorkers(o);
        }
      });
      var pendingQuotes = quotes.filter(function (q) { return open[String(q.order_id)]; }).length;
      var blocked = vendorWalletBlocked(row, limit);
      var crew = null;
      if (row.type === 'team' || row.type === 'company') {
        var size = Math.max(1, Number(row.team_size) || 1);
        var freeN = Math.max(0, size - busyN);
        crew = {
          kind: row.type,
          size: size,
          busy: Math.min(size, busyN),
          free: freeN,
          status: freeN <= 0 ? 'full' : (busyN <= 0 ? 'idle' : 'partial')
        };
      }
      return {
        vendor: publicVendor(row),
        today: { date: new Date(range.from).toISOString(), completed: completed, earnings: earnings },
        ongoing: { pendingQuotes: pendingQuotes, activeJobs: activeJobs },
        readiness: { online: !!row.is_online && !blocked, blocked: blocked, limit: limit },
        crew: crew
      };
    });
  };

  /* ===== 5.2 Chợ đơn + 5.3 Chi tiết đơn (thợ) ===== */
  // Sắp xếp chợ đơn: mới nhất / gấp nhất / gần nhất (gần = quãng đường điểm bốc → điểm trả ngắn nhất, vì chưa có vị trí của thợ).
  api.MARKET_SORTS = ['newest', 'urgent', 'nearest'];
  var SPEED_RANK = { urgent: 0, fast: 1, default: 2, custom: 2 };
  var WEIGHT_FALLBACK = { light: 'Nhẹ', medium: 'Vừa', heavy: 'Nặng', very_heavy: 'Rất nặng' };
  var ACTIVE_JOB = { matched: 1, arriving: 1, working: 1, completed: 1 };
  var LIVE_JOB = { matched: 1, arriving: 1, working: 1 }; // đơn đang làm — cá nhân chỉ được 1 cái

  // Thợ cá nhân: 1 slot (đơn matched/arriving/working, hoặc báo giá pending đơn khác). exceptId = đơn đang xem/sửa thì không tính.
  function personalSlot(vendor, liveOrders, quotes, exceptId) {
    if (!vendor || vendor.type !== 'personal') return null;
    exceptId = exceptId ? String(exceptId) : '';
    var job = (liveOrders || []).filter(function (o) {
      return LIVE_JOB[o.status] && String(o.id) !== exceptId;
    })[0];
    if (job) return { kind: 'job', order_id: String(job.id), code: TTV.Utils.orderCode(job.id) };
    var q = (quotes || []).filter(function (row) {
      return row.status === 'pending' && String(row.order_id) !== exceptId;
    })[0];
    if (q) return { kind: 'quote', order_id: String(q.order_id), code: TTV.Utils.orderCode(q.order_id) };
    return null;
  }
  function busyJobFail() {
    return fail('BUSY_JOB', 'Thợ cá nhân chỉ nhận 1 đơn tại một thời điểm. Hãy hoàn thành đơn đang làm rồi nhận đơn mới.');
  }
  function jobWorkers(o) { return Math.max(1, Number(o && o.workers) || 1); }
  // Số thợ đang bị giữ bởi đơn matched/arriving/working (trừ đơn đang xem nếu có).
  function teamBusyWorkers(liveOrders, exceptId) {
    var n = 0;
    exceptId = exceptId ? String(exceptId) : '';
    (liveOrders || []).forEach(function (o) {
      if (!LIVE_JOB[o.status]) return;
      if (exceptId && String(o.id) === exceptId) return;
      n += jobWorkers(o);
    });
    return n;
  }
  // Tổ đội/công ty: còn bao nhiêu người rảnh. Cá nhân không dùng (đã có personalSlot).
  function teamFree(v, liveOrders, exceptId) {
    var size = Math.max(1, Number(v && v.team_size) || 1);
    if (!v || v.type === 'personal') return size;
    return Math.max(0, size - teamBusyWorkers(liveOrders, exceptId));
  }

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
  // Đơn có khớp hồ sơ thợ không: loại NCC, số thợ ≤ người rảnh (đội đang làm đơn khác thì trừ ra), dịch vụ, khu vực.
  function orderFitsVendor(o, v, liveOrders, exceptId) {
    var provider = o.provider_type || 'any', workers = jobWorkers(o);
    if (provider !== 'any' && provider !== 'all' && provider !== v.type) return false;
    if (workers > Math.max(1, Number(v.team_size) || 1)) return false;
    if (workers >= 2 && v.type === 'personal') return false;
    if (v.type !== 'personal' && workers > teamFree(v, liveOrders, exceptId)) return false;
    if (!Array.isArray(v.services) || v.services.indexOf(o.service) < 0) return false;
    return areaMatches(v.areas, placeOf(o, 'pickup').addr);
  }
  // Lý do cụ thể đơn không khớp thợ ('' = khớp). Thứ tự: số thợ → người rảnh → loại NCC → dịch vụ → khu vực.
  function fitReason(o, v, liveOrders, exceptId) {
    var provider = o.provider_type || 'any', workers = jobWorkers(o), size = Math.max(1, Number(v.team_size) || 1);
    var left = teamFree(v, liveOrders, exceptId);
    if (workers >= 2 && v.type === 'personal') return 'Thợ cá nhân không nhận đơn từ 2 thợ trở lên.';
    if (workers > size) return 'Đơn cần ' + workers + ' thợ, đội của bạn chỉ có ' + size + '.';
    if (v.type !== 'personal' && workers > left) {
      return left <= 0
        ? 'Đội đang làm hết người. Hoàn thành đơn đang làm rồi mới nhận đơn mới.'
        : 'Đơn cần ' + workers + ' thợ, đội bạn đang còn ' + left + ' thợ rảnh.';
    }
    if (provider !== 'any' && provider !== 'all' && provider !== v.type) return 'Khách chỉ nhận loại nhà cung cấp khác.';
    if (!Array.isArray(v.services) || v.services.indexOf(o.service) < 0) return 'Đơn không thuộc dịch vụ bạn nhận.';
    if (!areaMatches(v.areas, placeOf(o, 'pickup').addr)) return 'Đơn nằm ngoài khu vực hoạt động của bạn.';
    return '';
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
      workers: workers, note: String(o.note || ''),
      user_offer: Number(o.user_offer) || 0, offer: api.currentOffer(o),
      final_price: Number(o.final_price) || 0, matched_at: o.matched_at || '',
      price_breakdown: o.price_breakdown || null,
      deadline: dl, remaining_ms: dl - env.now,
      my_quote: q ? { id: q.id, status: q.status, price: Number(q.price) || 0, eta_min: Number(q.eta_min) || 0, message: String(q.message || '') } : null
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
        TTV.Store.query('orders', function (o) {
          return o.status === 'finding' || (String(o.vendor_id) === id && LIVE_JOB[o.status]);
        }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id; }),
        api.listServices(), TTV.Store.get('pricing_config', 'default')
      ]);
    }).then(function (p) {
      var row = p[0], limit = p[1], rows = p[2] || [], quotes = p[3] || [];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      var blocked = vendorWalletBlocked(row, limit), ready = !!row.is_online && !blocked;
      var finding = [], live = [];
      rows.forEach(function (o) {
        if (o.status === 'finding') finding.push(o);
        if (LIVE_JOB[o.status] && String(o.vendor_id) === vid) live.push(o);
      });
      var env = marketEnv(p[5], p[4], quotes), list = [];
      var blockedWorkers = 0, blockedCapacity = 0;
      var hold = personalSlot(row, live, quotes, '');
      var size = Math.max(1, Number(row.team_size) || 1);
      var left = teamFree(row, live, '');
      if (ready && !(hold && hold.kind === 'job')) {
        finding.forEach(function (o) {
          if (deadlineMs(o, env.windowMin) <= env.now) return;
          if (hold && hold.kind === 'quote' && String(o.id) !== hold.order_id) return;
          if (!orderFitsVendor(o, row, live, '')) {
            var w = jobWorkers(o);
            if (row.type === 'personal' && w >= 2) blockedWorkers += 1;
            else if (row.type !== 'personal' && w > left && w <= size) blockedCapacity += 1;
            return;
          }
          list.push(marketView(o, env));
        });
      }
      return {
        vendor: publicVendor(row),
        readiness: { online: !!row.is_online, blocked: blocked, ready: ready, limit: limit },
        orders: api.sortMarketOrders(list, opts.sort || 'newest'),
        now: env.now,
        skip: {
          blocked_workers: blockedWorkers,
          blocked_capacity: blockedCapacity,
          finding: finding.length,
          busy_job: !!(hold && hold.kind === 'job'),
          busy_code: hold && hold.kind === 'job' ? hold.code : '',
          team_free: left,
          team_size: size,
          team_busy: row.type !== 'personal' && left < size
        }
      };
    });
  };

  // Việc của tôi: đơn đã ghép cho chính thợ (matched / arriving / working).
  api.listVendorJobs = function () {
    return requireVendorSelf().then(function (id) {
      return Promise.all([
        TTV.Store.query('orders', function (o) {
          return String(o.vendor_id) === id && (o.status === 'matched' || o.status === 'arriving' || o.status === 'working');
        }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id; }),
        api.listServices(),
        TTV.Store.get('pricing_config', 'default')
      ]);
    }).then(function (p) {
      var env = marketEnv(p[3], p[2], p[1]);
      var list = (p[0] || []).map(function (o) {
        var view = marketView(o, env);
        view.final_price = Number(o.final_price) || (view.my_quote && view.my_quote.price) || 0;
        view.matched_at = o.matched_at || o.created_at;
        return view;
      });
      list.sort(function (a, b) {
        return String(b.matched_at || '').localeCompare(String(a.matched_at || ''));
      });
      return { jobs: list };
    });
  };

  // Lịch sử công việc: đơn đã HOÀN THÀNH của chính thợ (mới nhất trước). Mở chi tiết bằng #/vendor/market/:id như Việc của tôi.
  api.listVendorHistory = function () {
    return requireVendorSelf().then(function (id) {
      return Promise.all([
        TTV.Store.query('orders', function (o) { return String(o.vendor_id) === id && o.status === 'completed'; }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id; }),
        api.listServices(),
        TTV.Store.get('pricing_config', 'default')
      ]);
    }).then(function (p) {
      var env = marketEnv(p[3], p[2], p[1]);
      var list = (p[0] || []).map(function (o) {
        var view = marketView(o, env);
        view.final_price = Number(o.final_price) || (view.my_quote && view.my_quote.price) || 0;
        view.completed_at = o.completed_at || o.matched_at || o.created_at || '';
        view.vendor_earning = o.vendor_earning == null || !isFinite(Number(o.vendor_earning)) ? null : Number(o.vendor_earning);
        return view;
      });
      list.sort(function (a, b) { return String(b.completed_at || '').localeCompare(String(a.completed_at || '')); });
      return { jobs: list };
    });
  };

  // KIO ghi đơn theo chunk: đọc giữa chừng có thể thiếu bản ghi. Đọc lại vài lần trước khi báo không thấy.
  function waitMs(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function getOrderFresh(oid, tries) {
    tries = tries == null ? 3 : tries;
    return TTV.Store.get('orders', oid, tries < 3 ? { force: true } : undefined).then(function (row) {
      if (row || tries <= 1) return row;
      return waitMs(280).then(function () { return getOrderFresh(oid, tries - 1); });
    });
  }
  function getVendorFresh(vid, tries) {
    tries = tries == null ? 3 : tries;
    return TTV.Store.get('vendors', vid, tries < 3 ? { force: true } : undefined).then(function (row) {
      if (row || tries <= 1) return row;
      return waitMs(280).then(function () { return getVendorFresh(vid, tries - 1); });
    });
  }

  // Chi tiết đơn cho thợ. Sau khi khách chọn: chỉ thợ được ghép xem được (kèm SĐT khách).
  // Thợ khác đã báo giá không vào chi tiết — chỉ nhận thông báo. Mã: ORDER_NOT_FOUND / UNAVAILABLE / NOT_ELIGIBLE / MATCHED_OTHER.
  api.getMarketOrder = function (orderId) {
    var vid, oid = String(orderId || '');
    return requireVendorSelf().then(function (id) {
      vid = id;
      return Promise.all([
        getVendorFresh(id), vendorWalletLimit(), getOrderFresh(oid),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id; }),
        TTV.Store.query('order_media', function (m) { return String(m.order_id) === oid; }),
        api.listServices(), TTV.Store.get('pricing_config', 'default'),
        TTV.Store.query('orders', function (o) { return String(o.vendor_id) === id && LIVE_JOB[o.status]; })
      ]);
    }).then(function (p) {
      var row = p[0], limit = p[1], o = p[2];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      if (!o) throw fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn này.');
      var mineQuotes = (p[3] || []).filter(function (q) { return String(q.order_id) === oid; });
      var env = marketEnv(p[6], p[5], mineQuotes);
      var mine = String(o.vendor_id || '') === vid, hasQuote = mineQuotes.length > 0;
      var open = o.status === 'finding' && deadlineMs(o, env.windowMin) > env.now;
      var fits = orderFitsVendor(o, row, p[7] || [], oid);
      var whyFit = fits ? '' : fitReason(o, row, p[7] || [], oid);
      var taken = o.status === 'matched' || o.status === 'arriving' || o.status === 'working' || o.status === 'completed';
      var hold = personalSlot(row, p[7] || [], p[3] || [], oid);
      if (!mine) {
        if (taken) {
          if (hasQuote) throw fail('MATCHED_OTHER', 'Đơn ' + TTV.Utils.orderCode(o.id) + ' đã được ghép với thợ khác.');
          throw fail('UNAVAILABLE', 'Đơn này không còn nhận báo giá.');
        }
        if (!open) throw fail('UNAVAILABLE', 'Đơn này không còn nhận báo giá.');
        if (!hasQuote && !fits) throw fail('NOT_ELIGIBLE', whyFit || 'Đơn này không phù hợp với hồ sơ của bạn.');
      }
      var view = marketView(o, env);
      view.is_mine = mine;
      view.can_act = open && fits && !!row.is_online && !vendorWalletBlocked(row, limit) && !hold;
      view.action = view.can_act ? 'quote' : null; // mọi đơn (1 thợ hay ≥ 2 thợ) cùng quy trình báo giá
      view.min_amount = Math.max(1, Math.round(Number(p[6] && p[6].min_amount) || 10000));
      view.fit_message = whyFit;
      view.busy_code = hold ? hold.code : '';
      view.block_reason = view.can_act ? '' : (o.status !== 'finding' ? 'taken' : !open ? 'expired' : !fits ? 'not_fit' : !row.is_online ? 'offline' : vendorWalletBlocked(row, limit) ? 'wallet' : hold ? 'busy' : 'wallet');
      view.media = (p[4] || []).map(mapMediaRow)
        .filter(function (m) { return m.path; })
        .sort(function (a, b) {
          if (a.role !== b.role) return a.role === 'proof' ? 1 : -1;
          return a.kind === b.kind ? 0 : (a.kind === 'image' ? -1 : 1);
        });
      // Tên khách luôn hiện; SĐT chỉ trả về khi đơn là của thợ và đã ghép (matched trở đi) — chưa ghép thì không rời khỏi API
      view.customer = null;
      if (!o.user_id) return view;
      var showPhone = mine && !!ACTIVE_JOB[o.status];
      return TTV.Store.get('users', o.user_id).then(function (u) {
        if (u) view.customer = { name: u.name || '', avatar: u.avatar_path || '', phone: showPhone ? (u.phone || '') : null };
        return view;
      });
    });
  };

  function advanceMineJob(orderId, allow, nextStatus, patch, note, noti) {
    var oid = String(orderId || '');
    allow = allow || [];
    return requireVendorSelf().then(function (vid) {
      return getOrderFresh(oid).then(function (o) {
        if (!o) throw fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn này.');
        if (String(o.vendor_id || '') !== vid) throw fail('FORBIDDEN', 'Đây không phải việc của bạn.');
        if (o.status === nextStatus) return o;
        if (allow.indexOf(o.status) < 0) throw fail('CONFLICT', 'Đơn chưa ở bước này.');
        var now = new Date().toISOString();
        var extra = typeof patch === 'function' ? patch(now, o) : (patch || {});
        extra.status = nextStatus;
        extra.timeline = (Array.isArray(o.timeline) ? o.timeline : []).concat([{ event: nextStatus, at: now }]);
        var next = Object.assign({}, o, extra);
        var ev = { id: TTV.Utils.id(), order_id: oid, event: nextStatus, actor_type: 'vendor', actor_id: vid, note: note || '', created_at: now };
        return TTV.Store.put('orders', next).then(function () { return TTV.Store.put('order_events', ev); }).then(function () {
          pingLive('orders');
          if (noti && o.user_id) {
            background(api.pushNotification({
              event: noti.event, category: 'order', title: noti.title,
              body: noti.body.replace('{code}', TTV.Utils.orderCode(oid)),
              order_id: oid, recipient_type: 'customer', recipient_id: String(o.user_id)
            }));
          }
          return next;
        });
      });
    });
  }
  api.startVendorTrip = function (orderId) {
    return advanceMineJob(orderId, ['matched'], 'arriving', function (now) { return { arriving_at: now }; }, 'Bắt đầu đến', {
      event: 'order.arriving', title: 'Thợ đang đến', body: 'Thợ đang đến điểm bốc cho đơn {code}.'
    });
  };
  api.markVendorWorking = function (orderId) {
    return advanceMineJob(orderId, ['arriving'], 'working', function (now) { return { working_at: now }; }, 'Đã đến, bắt đầu bốc', {
      event: 'order.working', title: 'Thợ đang bốc vác', body: 'Thợ đã đến và bắt đầu bốc vác đơn {code}.'
    });
  };
  api.completeVendorJob = function (orderId, input) {
    input = input || {};
    var media = Array.isArray(input.media) ? input.media : [];
    var photos = media.filter(function (m) { return m && (m.kind || 'image') !== 'video'; });
    var videos = media.filter(function (m) { return m && m.kind === 'video'; });
    if (!photos.length || !videos.length) {
      return Promise.reject(fail('VALIDATION', 'Hãy thêm ít nhất 1 ảnh và 1 video minh chứng đã xong việc.', { errors: { media: true } }));
    }
    return requireVendorSelf().then(function (vid) {
      var oid = String(orderId || '');
      var proof = media.map(function (m) {
        return Object.assign({}, m, { role: 'proof', kind: m.kind === 'video' ? 'video' : 'image' });
      });
      return saveOrderMedia(oid, vid, proof).then(function () {
        return Promise.all([TTV.Store.get('vendors', vid), api.getSetting('commission_default')]);
      }).then(function (p) {
        var vendor = p[0], didComplete = false;
        var defRate = Number(p[1]);
        if (!isFinite(defRate)) defRate = 15;
        var rate = vendor && vendor.commission_rate != null && vendor.commission_rate !== ''
          ? Number(vendor.commission_rate) : defRate;
        if (!isFinite(rate)) rate = defRate;
        return advanceMineJob(oid, ['working'], 'completed', function (now, o) {
          didComplete = true;
          var price = Math.round(Number(o.final_price) || 0);
          var commission = Math.round(price * rate / 100);
          return {
            completed_at: now,
            commission_rate: rate,
            commission_amount: commission,
            vendor_earning: Math.max(0, price - commission)
          };
        }, 'Hoàn thành', {
          event: 'order.completed', title: 'Đơn đã hoàn thành', body: 'Đơn {code} đã hoàn thành.'
        }).then(function (next) {
          if (!didComplete) return next;
          var code = TTV.Utils.orderCode(oid);
          var row = vendor;
          background(
            api.pushNotification({
              event: 'order.completed',
              category: 'order',
              title: 'Bạn đã hoàn thành đơn hàng',
              body: 'Đơn ' + code + ' đã hoàn thành.',
              order_id: oid,
              recipient_type: 'vendor',
              recipient_id: String(vid)
            }).catch(function () { return null; }).then(function () {
              if (!row || !row.id) return next;
              return TTV.Store.put('vendors', Object.assign({}, row, { jobs_done: (Number(row.jobs_done) || 0) + 1 }));
            }).then(function () { pingLive('noti'); })
          );
          return next;
        });
      });
    });
  };

  /* ===== 5.4 Báo giá (mọi đơn, 1 thợ hay ≥ 2 thợ): gửi / sửa / rút ===== */
  var QUOTE_ETA_MAX = 240, QUOTE_MSG_MAX = 200;
  function validateQuoteInput(input, cap, min) {
    var errors = {}, price = Number(input && input.price), eta = Number(input && input.eta_min);
    var msg = String(input && input.message != null ? input.message : '').trim();
    if (!Number.isInteger(price)) errors.price = 'Hãy nhập giá báo bằng số nguyên (đồng).';
    else if (price < min) errors.price = 'Giá báo tối thiểu ' + TTV.Utils.money(min) + '.';
    else if (price > cap) errors.price = 'Giá báo tối đa bằng số tiền khách trả (' + TTV.Utils.money(cap) + ').';
    if (!Number.isInteger(eta) || eta < 1 || eta > QUOTE_ETA_MAX) errors.eta_min = 'Thời gian đến từ 1 đến ' + QUOTE_ETA_MAX + ' phút.';
    if (msg.length > QUOTE_MSG_MAX) errors.message = 'Lời nhắn tối đa ' + QUOTE_MSG_MAX + ' ký tự.';
    return { ok: !Object.keys(errors).length, errors: errors, price: price, eta: eta, message: msg };
  }
  function latestQuote(rows) { // mỗi thợ chỉ có 1 dòng/đơn; nếu lỡ có nhiều thì lấy dòng mới nhất
    return (rows || []).slice().sort(function (a, b) { return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')); })[0] || null;
  }
  function loadQuoteContext(orderId) {
    var oid = String(orderId || ''), vid;
    return requireVendorSelf().then(function (id) {
      vid = id;
      return Promise.all([
        TTV.Store.get('vendors', id), vendorWalletLimit(), TTV.Store.get('orders', oid),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === id && String(q.order_id) === oid; }),
        TTV.Store.get('pricing_config', 'default')
      ]);
    }).then(function (p) {
      var row = p[0];
      if (!row) throw notFoundVendor();
      if ((row.status || 'active') === 'locked') throw fail('LOCKED', 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên.');
      if (!p[2]) throw fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn này.');
      return { vid: vid, oid: oid, vendor: row, limit: p[1], order: p[2], cur: latestQuote(p[3]), cfg: p[4] || {} };
    });
  }
  // Gửi báo giá mới / sửa báo giá đang chờ / báo lại sau khi đã rút. Input: { order_id, price, eta_min, message }
  api.submitQuote = function (input) {
    input = input || {};
    return loadQuoteContext(input.order_id).then(function (c) { // đọc lại đơn ngay trước khi ghi
      var o = c.order, cur = c.cur;
      if (o.status !== 'finding') throw fail('ORDER_TAKEN', 'Đơn đã được ghép thợ khác hoặc không còn nhận báo giá.');
      if (deadlineMs(o, c.cfg.quote_window_min) <= Date.now()) throw fail('UNAVAILABLE', 'Đơn đã hết hạn nhận báo giá.');
      if (!c.vendor.is_online) throw fail('OFFLINE', 'Hãy bật Sẵn sàng nhận đơn để báo giá.');
      if (vendorWalletBlocked(c.vendor, c.limit)) throw fail('WALLET_LOCKED', 'Số dư ví đang âm quá ngưỡng nên bạn tạm không báo giá được.');
      if (cur && cur.status === 'accepted') throw fail('QUOTE_LOCKED', 'Báo giá của bạn đã được chọn, không sửa được nữa.');
      return Promise.all([
        TTV.Store.query('orders', function (row) { return String(row.vendor_id) === c.vid && LIVE_JOB[row.status]; }, { force: true }),
        TTV.Store.query('quotes', function (q) { return String(q.vendor_id) === c.vid && q.status === 'pending'; })
      ]).then(function (extra) {
        if (personalSlot(c.vendor, extra[0], extra[1], c.oid)) throw busyJobFail();
        var why = fitReason(o, c.vendor, extra[0], c.oid);
        if (why) throw fail('NOT_ELIGIBLE', why);
        var cap = api.currentOffer(o), min = Math.max(1, Math.round(Number(c.cfg.min_amount) || 10000));
        var v = validateQuoteInput(input, cap, min);
        if (!v.ok) throw fail('VALIDATION', 'Thông tin báo giá chưa hợp lệ.', { errors: v.errors });
        var now = new Date().toISOString(), isNew = !cur || cur.status !== 'pending';
        var row = cur ? Object.assign({}, cur) : { id: TTV.Utils.id(), order_id: c.oid, vendor_id: c.vid, created_at: now };
        if (isNew) row.created_at = now; // báo lại sau khi rút = báo giá mới
        Object.assign(row, { price: v.price, eta_min: v.eta, message: v.message, status: 'pending', updated_at: now, withdrawn_at: null });
        var ev = { id: TTV.Utils.id(), order_id: c.oid, event: 'quoted', actor_type: 'vendor', actor_id: c.vid,
          note: (isNew ? 'Báo giá ' : 'Sửa báo giá ') + v.price, created_at: now };
        return TTV.Store.put('quotes', row).then(function () { return TTV.Store.put('order_events', ev); })
          .then(function () {
            pingLive('orders');
            if (isNew && o.user_id) {
              background(api.pushNotification({
                event: 'quote.new', category: 'order', title: 'Có báo giá mới',
                body: 'Đơn ' + TTV.Utils.orderCode(c.oid) + ' có báo giá mới.',
                order_id: c.oid, recipient_type: 'customer', recipient_id: o.user_id
              }));
            }
            return row;
          });
      });
    });
  };
  // Rút báo giá: chỉ khi còn `pending` và đơn còn `finding`. Rút xong báo lại được nếu đơn còn hạn.
  api.withdrawQuote = function (orderId) {
    return loadQuoteContext(orderId).then(function (c) {
      var cur = c.cur;
      if (!cur) throw fail('QUOTE_NOT_FOUND', 'Bạn chưa có báo giá cho đơn này.');
      if (cur.status === 'accepted') throw fail('QUOTE_LOCKED', 'Báo giá đã được chọn, không rút được.');
      if (cur.status !== 'pending') throw fail('QUOTE_INACTIVE', 'Báo giá này không còn hiệu lực.');
      if (c.order.status !== 'finding') throw fail('ORDER_TAKEN', 'Đơn đã được ghép thợ khác hoặc không còn nhận báo giá.');
      var now = new Date().toISOString();
      var row = Object.assign({}, cur, { status: 'withdrawn', withdrawn_at: now, updated_at: now });
      var ev = { id: TTV.Utils.id(), order_id: c.oid, event: 'quoted', actor_type: 'vendor', actor_id: c.vid, note: 'Rút báo giá', created_at: now };
      return TTV.Store.put('quotes', row).then(function () { return TTV.Store.put('order_events', ev); }).then(function () { pingLive('orders'); return row; });
    });
  };

  function mapMediaRow(m) {
    return {
      id: String(m.id),
      kind: m.kind === 'video' ? 'video' : 'image',
      path: String(m.path || ''),
      duration: Number(m.duration) || 0,
      role: m.role === 'proof' ? 'proof' : 'order'
    };
  }
  function saveOrderMedia(orderId, ownerId, items) {
    return (items || []).reduce(function (chain, item) {
      return chain.then(function () {
        if (!item) return null;
        var kind = item.kind === 'video' ? 'video' : 'image';
        var role = item.role === 'proof' ? 'proof' : 'order';
        function putRow(path, duration) {
          if (!path) return null;
          return TTV.Store.put('order_media', {
            id: TTV.Utils.id(), order_id: orderId, kind: kind, role: role, path: path, duration: Number(duration) || 0
          });
        }
        if (item.path) return putRow(item.path, item.duration);
        if (item.file && TTV.Upload && TTV.Upload.upload) {
          var folder = kind === 'video' ? 'order-videos' : 'order-images';
          return TTV.Upload.upload(item.file, { kind: folder, ownerId: ownerId }).then(function (saved) {
            if (!saved || !saved.path) throw fail('UPLOAD', 'Không lưu được ảnh/video.');
            return putRow(saved.path, (saved && saved.duration) || item.duration);
          });
        }
        return null;
      });
    }, Promise.resolve());
  }

  function notifyVendorsNewOrder(order) {
    return Promise.all([
      TTV.Store.list('vendors'),
      vendorWalletLimit(),
      TTV.Store.query('orders', function (o) { return LIVE_JOB[o.status]; })
    ]).then(function (p) {
      var limit = p[1], liveBy = {};
      (p[2] || []).forEach(function (o) {
        var k = String(o.vendor_id || '');
        if (!k) return;
        if (!liveBy[k]) liveBy[k] = [];
        liveBy[k].push(o);
      });
      var targets = (p[0] || []).filter(function (v) {
        if ((v.status || 'active') === 'locked') return false;
        if (!v.is_online) return false;
        if (vendorWalletBlocked(v, limit)) return false;
        return orderFitsVendor(order, v, liveBy[String(v.id)] || []);
      });
      return targets.reduce(function (chain, v) {
        return chain.then(function () {
          return api.pushNotification({
            event: 'order.new', silent: true, category: 'order',
            title: 'Có đơn mới',
            body: 'Đơn ' + TTV.Utils.orderCode(order.id) + ' khớp với bạn. Vào chợ đơn để báo giá.',
            order_id: order.id, recipient_type: 'vendor', recipient_id: String(v.id)
          });
        });
      }, Promise.resolve()).then(function () {
        if (targets.length) pingLive('noti');
      });
    });
  }

  // Tạo đơn: ghi orders + order_events + order_media + notifications. Sau này chỉ đổi Store sang KIO.
  api.createOrder = function (input) {
    input = input || {};
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập để đặt đơn.'));
    if (input.pay_method && input.pay_method !== 'cash') {
      return Promise.reject(fail('PAY_LOCKED', 'Thanh toán ví sắp có. Hãy chọn tiền mặt.'));
    }
    var pickup = input.pickup || {}, dropoff = input.dropoff || {};
    if (!pickup.addr || pickup.lat == null || !dropoff.addr || dropoff.lat == null) {
      return Promise.reject(fail('VALIDATION', 'Hãy chọn điểm bốc và điểm trả.'));
    }
    var offer = Math.round(Number(input.user_offer) || 0);
    return Promise.all([
      TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve({}),
      TTV.Store.get('services', input.service)
    ]).then(function (pack) {
      var cfg = pack[0] || {}, svc = pack[1];
      if (!svc) svc = { id: input.service, code: input.service, name: '', base_price: 0 };
      var min = Math.max(0, Math.round(Number(cfg.min_amount) || 0));
      var quote = TTV.pricing.quote({
        basePrice: svc.base_price, weight: input.weight, km: input.distance_km,
        pickupFloor: input.pickup_floor, pickupElevator: input.pickup_elevator,
        needUnload: input.need_unload, dropFloor: input.drop_floor, dropElevator: input.drop_elevator,
        workers: input.workers
      });
      var urgentMin = input.speed === 'urgent' ? TTV.pricing.urgentMin(quote.total) : min;
      if (offer < Math.max(min, urgentMin)) {
        return Promise.reject(fail('VALIDATION', 'Số tiền bạn trả chưa đạt mức tối thiểu.'));
      }
      var nowMs = Date.now();
      var now = new Date(nowMs).toISOString();
      var oid = TTV.Utils.id();
      var windowMs = TTV.pricing && TTV.pricing.quoteWindowMs ? TTV.pricing.quoteWindowMs() : Math.round(Number(cfg.quote_window_min) || 0) * 60000;
      var deadline = windowMs > 0 ? new Date(nowMs + windowMs).toISOString() : null;
      var order = {
        id: oid,
        code: TTV.Utils.orderCode(oid).replace(/^#/, ''),
        user_id: s.account_id,
        service: svc.code || svc.id,
        pickup: { addr: String(pickup.addr), lat: Number(pickup.lat), lng: Number(pickup.lng) },
        dropoff: { addr: String(dropoff.addr), lat: Number(dropoff.lat), lng: Number(dropoff.lng) },
        distance_km: Math.round(Number(input.distance_km || quote.km) * 100) / 100,
        weight_tier: input.weight || 'medium',
        pickup_floor: Math.max(0, Math.round(Number(input.pickup_floor) || 0)),
        pickup_elevator: !!input.pickup_elevator,
        need_unload: input.need_unload !== false,
        drop_floor: Math.max(0, Math.round(Number(input.drop_floor) || 0)),
        drop_elevator: !!input.drop_elevator,
        workers: Math.max(1, Math.round(Number(input.workers) || 1)),
        note: String(input.note || '').trim().slice(0, 500),
        schedule_type: 'now',
        speed: input.speed || 'default',
        provider_type: input.provider_type || 'any',
        user_offer: offer,
        price_breakdown: {
          base: quote.base, weight: quote.weight, floor: quote.floor,
          distance: quote.distance, workers: quote.workersFee, discount: 0
        },
        total: quote.total,
        pay_method: 'cash',
        coupon_id: '',
        status: 'finding',
        vendor_id: '',
        final_price: null,
        quote_deadline: deadline,
        timeline: [{ event: 'created', at: now }],
        cancel_reason: '',
        created_at: now
      };
      var ev = {
        id: TTV.Utils.id(), order_id: oid, event: 'created',
        actor_type: 'customer', actor_id: s.account_id, note: '', created_at: now
      };
      return TTV.Store.put('orders', order).then(function () {
        return TTV.Store.put('order_events', ev);
      }).then(function () {
        return saveOrderMedia(oid, s.account_id, input.media);
      }).then(function () {
        pingLive('orders');
        background(
          api.pushNotification({
            event: 'order.created', category: 'order', title: 'Đơn hàng đã được tạo!',
            body: 'Đơn ' + TTV.Utils.orderCode(oid) + ' đang tìm thợ.',
            order_id: oid, recipient_type: 'customer', recipient_id: s.account_id
          }).then(function () { return notifyVendorsNewOrder(order); })
        );
        return order;
      });
    });
  };

  function quoteDeadlineMs(row, windowMs) {
    if (row && row.quote_deadline) {
      var t = Date.parse(row.quote_deadline);
      if (isFinite(t)) return t;
    }
    if (row && row.created_at && windowMs > 0) {
      var start = Date.parse(row.created_at);
      if (isFinite(start)) return start + windowMs;
    }
    return 0;
  }

  function cancelFindingRow(fresh, opts) {
    opts = opts || {};
    var now = new Date().toISOString();
    var reason = opts.reason || 'Khách hủy';
    var actorType = opts.actor_type || 'customer';
    var actorId = opts.actor_id || '';
    var next = Object.assign({}, fresh, {
      status: 'cancelled', cancel_reason: reason, cancelled_at: now
    });
    var ev = {
      id: TTV.Utils.id(), order_id: fresh.id, event: 'cancelled',
      actor_type: actorType, actor_id: actorId, note: reason, created_at: now
    };
    return TTV.Store.put('orders', next).then(function () {
      return TTV.Store.put('order_events', ev);
    }).then(function () {
      return TTV.Store.query('quotes', function (q) {
        return String(q.order_id) === String(fresh.id) && q.status === 'pending';
      });
    }).then(function (pending) {
      var code = TTV.Utils.orderCode(fresh.id);
      var jobs = [];
      if (opts.notify && fresh.user_id) {
        jobs.push({
          event: 'order.cancelled', category: 'order',
          title: opts.title || reason,
          body: 'Đơn ' + code + ' đã bị hủy.',
          order_id: fresh.id, recipient_type: 'customer', recipient_id: fresh.user_id, silent: true
        });
      }
      var seen = {};
      (pending || []).forEach(function (q) {
        if (!q.vendor_id || seen[q.vendor_id]) return;
        seen[q.vendor_id] = true;
        jobs.push({
          event: 'order.cancelled', category: 'order', title: 'Đơn đã hủy',
          body: 'Đơn ' + code + ' đã bị hủy.',
          order_id: fresh.id, recipient_type: 'vendor', recipient_id: String(q.vendor_id), silent: true
        });
      });
      background(
        jobs.reduce(function (chain, payload) {
          return chain.then(function () { return api.pushNotification(payload); });
        }, Promise.resolve()).then(function () { if (jobs.length) pingLive('noti'); })
      );
      return closePendingQuotes(fresh.id, 'expired', now);
    }).then(function () { pingLive('orders'); return next; });
  }
  // Đổi mọi báo giá `pending` của đơn sang trạng thái mới (expired/rejected), trừ báo giá có id = exceptId.
  function closePendingQuotes(orderId, status, now, exceptId) {
    return TTV.Store.query('quotes', function (q) { return String(q.order_id) === String(orderId) && q.status === 'pending' && String(q.id) !== String(exceptId || ''); })
      .then(function (rows) {
        return rows.reduce(function (chain, q) {
          return chain.then(function () { return TTV.Store.put('quotes', Object.assign({}, q, { status: status, updated_at: now })); });
        }, Promise.resolve()).then(function () { return rows; });
      });
  }

  api.listOrderMedia = function (id) {
    return api.getOrder(id).then(function (order) {
      return TTV.Store.query('order_media', function (m) { return String(m.order_id) === String(order.id); }).then(function (rows) {
        return (rows || []).map(mapMediaRow).filter(function (m) { return m.path; }).sort(function (a, b) {
          if (a.role !== b.role) return a.role === 'proof' ? 1 : -1;
          return a.kind === b.kind ? 0 : (a.kind === 'image' ? -1 : 1);
        });
      });
    });
  };

  function customerVendorView(v, withPhone) {
    if (!v) return null;
    return {
      id: String(v.id), name: v.name || '', type: v.type || 'personal',
      team_size: Number(v.team_size) || 1, rating: Number(v.rating) || 0,
      jobs_done: Number(v.jobs_done) || 0, avatar_path: v.avatar_path || '',
      phone: withPhone ? String(v.phone || '') : ''
    };
  }
  function withCustomerMatch(order) {
    if (!order) return order;
    var live = order.status === 'matched' || order.status === 'arriving' || order.status === 'working' || order.status === 'completed';
    if (!live || !order.vendor_id) return Object.assign({}, order, { vendor: null, accepted_quote: null });
    var qid = order.accepted_quote_id;
    var quoteP = qid
      ? TTV.Store.get('quotes', qid)
      : TTV.Store.query('quotes', function (q) {
          return String(q.order_id) === String(order.id) && q.status === 'accepted';
        }).then(function (rows) { return (rows && rows[0]) || null; });
    return Promise.all([TTV.Store.get('vendors', order.vendor_id), quoteP]).then(function (p) {
      var v = p[0], q = p[1];
      return Object.assign({}, order, {
        vendor: customerVendorView(v, true),
        accepted_quote: q ? {
          id: String(q.id),
          price: Number(q.price) || Number(order.final_price) || 0,
          eta_min: Number(q.eta_min) || 0,
          message: String(q.message || '')
        } : null
      });
    });
  }
  api.getOrder = function (id) {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var oid = String(id);
    return getOrderFresh(oid).then(function (row) {
      if (!row || row.user_id !== s.account_id) throw fail('NOT_FOUND', 'Không tìm thấy đơn hàng.');
      return api.expireFindingIfNeeded(row).then(withCustomerMatch);
    });
  };

  api.expireFindingIfNeeded = function (idOrRow) {
    var given = idOrRow && typeof idOrRow === 'object' ? idOrRow : null;
    var oid = String((given && given.id) || idOrRow || '');
    var load = given ? Promise.resolve(given) : TTV.Store.get('orders', oid, { force: true });
    return load.then(function (row) {
      if (!row || row.status !== 'finding') return row;
      var ready = TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve({});
      return ready.then(function (cfg) {
        var windowMs = TTV.pricing && TTV.pricing.quoteWindowMs ? TTV.pricing.quoteWindowMs() : Math.round(Number(cfg && cfg.quote_window_min) || 0) * 60000;
        var end = quoteDeadlineMs(row, windowMs);
        if (!end || Date.now() < end) return row;
        return TTV.Store.get('orders', oid, { force: true }).then(function (fresh) {
          if (!fresh || fresh.status !== 'finding') return fresh || row;
          return cancelFindingRow(fresh, {
            reason: 'Không tìm được thợ',
            actor_type: 'system',
            actor_id: 'system',
            notify: true
          });
        });
      });
    });
  };

  api.cancelFindingOrder = function (id) {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var oid = String(id);
    return TTV.Store.get('orders', oid).then(function (row) {
      if (!row || row.user_id !== s.account_id) throw fail('NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (row.status !== 'finding') throw fail('CONFLICT', 'Không hủy được đơn ở trạng thái này.');
      return TTV.Store.get('orders', oid).then(function (fresh) {
        if (!fresh || fresh.status !== 'finding') throw fail('CONFLICT', 'Đơn đã được cập nhật. Hãy tải lại.');
        return cancelFindingRow(fresh, {
          reason: 'Khách hủy',
          title: 'Đơn hàng đã bị hủy',
          actor_type: 'customer',
          actor_id: s.account_id,
          notify: true
        });
      });
    });
  };
  /* ===== 5.6 Màn "Đang nhận báo giá" (khách): xem báo giá của mọi thợ/tổ đội/công ty, tự chọn ===== */
  // Khách chỉ thấy báo giá `pending` (đơn đang `finding`) hoặc báo giá `accepted` (đơn đã ghép). SĐT thợ chỉ có ở báo giá đã được chọn.
  api.listOrderQuotes = function (id) {
    var oid = String(id);
    return api.getOrder(oid).then(function (order) {
      return Promise.all([
        TTV.Store.query('quotes', function (q) { return String(q.order_id) === oid; }),
        TTV.Store.list('vendors')
      ]).then(function (p) {
        var vmap = {}; (p[1] || []).forEach(function (v) { vmap[String(v.id)] = v; });
        var want = order.status === 'finding' ? 'pending' : 'accepted';
        var list = (p[0] || []).filter(function (q) { return q.status === want; }).map(function (q) {
          var v = vmap[String(q.vendor_id)] || {};
          return {
            id: String(q.id), order_id: oid, vendor_id: String(q.vendor_id), price: Number(q.price) || 0, eta_min: Number(q.eta_min) || 0,
            message: String(q.message || ''), status: q.status, created_at: q.created_at, updated_at: q.updated_at,
            vendor: {
              id: String(q.vendor_id), name: v.name || '', type: v.type || 'personal', team_size: Number(v.team_size) || 1,
              rating: Number(v.rating) || 0, jobs_done: Number(v.jobs_done) || 0, avatar_path: v.avatar_path || '',
              phone: q.status === 'accepted' ? (v.phone || '') : ''
            }
          };
        });
        list.sort(function (a, b) { return (a.price - b.price) || String(a.created_at || '').localeCompare(String(b.created_at || '')); }); // thấp → cao
        return { order: order, quotes: list };
      });
    });
  };

  // Khách chọn một báo giá: báo giá → accepted, còn lại → rejected, đơn → matched (final_price = giá báo giá được chọn).
  api.chooseQuote = function (orderId, quoteId) {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var oid = String(orderId), qid = String(quoteId);
    return api.expireFindingIfNeeded(oid).then(function () { // đọc lại trạng thái ngay trước khi ghi
      return Promise.all([TTV.Store.get('orders', oid), TTV.Store.get('quotes', qid)]);
    }).then(function (p) {
      var o = p[0], q = p[1];
      if (!o || o.user_id !== s.account_id) throw fail('NOT_FOUND', 'Không tìm thấy đơn hàng.');
      if (o.status === 'cancelled') throw fail('CONFLICT', 'Đơn đã bị hủy hoặc hết hạn nhận báo giá.');
      if (o.status !== 'finding') throw fail('CONFLICT', 'Đơn đã được ghép thợ.');
      if (!q || String(q.order_id) !== oid) throw fail('QUOTE_NOT_FOUND', 'Không tìm thấy báo giá này.');
      if (q.status !== 'pending') throw fail('QUOTE_GONE', 'Thợ vừa rút hoặc sửa báo giá. Hãy xem lại danh sách.');
      return TTV.Store.get('vendors', q.vendor_id).then(function (v) {
        if (!v || (v.status || 'active') === 'locked') throw fail('QUOTE_GONE', 'Thợ này hiện không nhận đơn được. Hãy chọn thợ khác.');
        return TTV.Store.query('orders', function (row) {
          return String(row.vendor_id) === String(v.id) && LIVE_JOB[row.status];
        }, { force: true }).then(function (jobs) {
          if (v.type === 'personal') {
            if (jobs && jobs.length) throw fail('QUOTE_GONE', 'Thợ này đang làm đơn khác. Hãy chọn thợ khác.');
            return v;
          }
          var need = jobWorkers(o), left = teamFree(v, jobs, oid);
          if (need > left) {
            throw fail('QUOTE_GONE', left <= 0
              ? 'Tổ đội/công ty này đang làm hết người. Hãy chọn nhà cung cấp khác.'
              : 'Tổ đội/công ty này còn ' + left + ' thợ rảnh, đơn cần ' + need + '. Hãy chọn nhà cung cấp khác.');
          }
          return v;
        });
      }).then(function (v) {
        var price = Number(q.price) || 0, now = new Date().toISOString();
        var tl = (Array.isArray(o.timeline) ? o.timeline : []).concat([{ event: 'matched', at: now }]);
        // Đơn ví: hoàn phần chênh lệch user_offer − final_price sẽ nối ở task 7.3 (hiện đơn mới chỉ trả tiền mặt).
        var next = Object.assign({}, o, { status: 'matched', vendor_id: String(q.vendor_id), accepted_quote_id: qid, final_price: price, matched_at: now, timeline: tl });
        var ev = { id: TTV.Utils.id(), order_id: oid, event: 'matched', actor_type: 'customer', actor_id: s.account_id, note: 'Chọn ' + (v.name || q.vendor_id) + ' · ' + price, created_at: now };
        return TTV.Store.put('orders', next).then(function () {
          return TTV.Store.put('quotes', Object.assign({}, q, { status: 'accepted', updated_at: now }));
        }).then(function () {
          return closePendingQuotes(oid, 'rejected', now, qid);
        }).then(function (rejected) {
          return TTV.Store.put('order_events', ev).then(function () { return rejected; });
        }).then(function (rejected) {
          pingLive('orders');
          var code = TTV.Utils.orderCode(oid);
          var who = v.name || 'thợ';
          background(
            api.pushNotification({
              event: 'quote.accepted', category: 'order',
              title: 'Khách đã chọn bạn — đơn ' + code,
              body: 'Mở chi tiết đơn để gọi khách và bắt đầu đến.',
              order_id: oid, recipient_type: 'vendor', recipient_id: String(q.vendor_id)
            }).then(function () {
              return rejected.reduce(function (chain, r) {
                return chain.then(function () {
                  return api.pushNotification({
                    event: 'quote.rejected', category: 'order',
                    title: 'Đơn ' + code + ' đã được ghép với thợ khác',
                    body: 'Khách đã chọn thợ khác. Bạn không xem được thông tin khách của đơn này.',
                    order_id: oid, recipient_type: 'vendor', recipient_id: String(r.vendor_id),
                    href: '/vendor/market'
                  });
                });
              }, Promise.resolve());
            }).then(function () {
              return api.pushNotification({
                event: 'order.matched', category: 'order',
                title: 'Đã ghép thợ thành công',
                body: 'Đơn ' + code + ' đã ghép với ' + who + '. Bạn trả ' + TTV.Utils.money(price) + '. Theo dõi đơn để biết khi thợ đang đến.',
                order_id: oid, recipient_type: 'customer', recipient_id: String(o.user_id)
              });
            })
          );
          return { order: next, quote_id: qid };
        });
      });
    });
  };

  /* ===== 7.1 Ví khách ===== */
  function publicWalletTx(row) {
    return {
      id: String(row.id),
      type: row.type === 'payment' || row.type === 'refund' || row.type === 'hold' ? row.type : 'topup',
      amount: Number(row.amount) || 0,
      method: String(row.method || ''),
      status: row.status === 'success' || row.status === 'failed' ? row.status : 'pending',
      order_id: row.order_id ? String(row.order_id) : '',
      created_at: row.created_at || ''
    };
  }
  api.getWallet = function () {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    return TTV.Store.get('users', s.account_id).then(function (u) {
      if (!u) throw fail('NO_USER', 'Không tìm thấy tài khoản.');
      return { balance: Number(u.wallet_balance) || 0 };
    });
  };
  api.listWalletTransactions = function (opts) {
    opts = opts || {};
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var uid = String(s.account_id);
    var tab = opts.tab || 'all';
    return TTV.Store.query('wallet_transactions', function (row) {
      return String(row.user_id) === uid;
    }).then(function (rows) {
      var list = (rows || []).map(publicWalletTx).sort(function (a, b) {
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
      if (tab === 'topup') list = list.filter(function (x) { return x.type === 'topup'; });
      else if (tab === 'payment') list = list.filter(function (x) { return x.type === 'payment' || x.type === 'hold'; });
      else if (tab === 'refund') list = list.filter(function (x) { return x.type === 'refund'; });
      if (opts.limit != null) list = list.slice(0, Math.max(0, Number(opts.limit) || 0));
      return list;
    });
  };

  /* ===== 7.4 Mã giảm giá (khách) ===== */
  function publicCoupon(c, extra) {
    var out = {
      code: String(c.code || c.id || ''),
      title: String(c.title || c.code || ''),
      condition: String(c.condition || ''),
      min_workers: Math.max(1, Math.round(Number(c.min_workers) || 2)),
      discount_type: c.discount_type === 'fixed' ? 'fixed' : 'percent',
      discount_value: Number(c.discount_value) || 0,
      max_discount: Number(c.max_discount) || 0,
      min_order: Number(c.min_order) || 0,
      expires_at: c.expires_at || ''
    };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }
  function couponExpired(c, now) {
    var exp = c && c.expires_at ? new Date(c.expires_at).getTime() : NaN;
    return !!c && (c.status === 'expired' || (isFinite(exp) && exp < (now == null ? Date.now() : now)));
  }
  function userCouponId(uid, code) { return 'uc-' + String(uid) + '-' + String(code); }
  function normalizeCouponCode(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase(); }

  // 3 tab Khả dụng / Đã dùng / Hết hạn. Mã hết hạn của hệ thống luôn hiện ở tab Hết hạn (đúng ảnh 10-ma-giam-gia-2).
  api.listMyCoupons = function () {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var uid = String(s.account_id), now = Date.now();
    return Promise.all([
      TTV.Store.list('coupons'),
      TTV.Store.query('user_coupons', function (r) { return String(r.user_id) === uid; })
    ]).then(function (res) {
      var byCode = {};
      (res[0] || []).forEach(function (c) { byCode[String(c.code || c.id)] = c; });
      var out = { available: [], used: [], expired: [] }, seen = {};
      (res[1] || []).forEach(function (uc) {
        var code = String(uc.coupon_code), c = byCode[code];
        if (!c || seen[code]) return;
        seen[code] = true;
        if (uc.status === 'used') out.used.push(publicCoupon(c, { used_order_id: uc.used_order_id || '' }));
        else if (uc.status === 'expired' || couponExpired(c, now)) out.expired.push(publicCoupon(c));
        else out.available.push(publicCoupon(c));
      });
      Object.keys(byCode).forEach(function (code) {
        if (!seen[code] && couponExpired(byCode[code], now)) out.expired.push(publicCoupon(byCode[code]));
      });
      var byExp = function (a, b) { return String(a.expires_at).localeCompare(String(b.expires_at)); };
      out.available.sort(byExp);
      out.expired.sort(function (a, b) { return byExp(b, a); });
      return out;
    });
  };

  // Nhập mã → thêm vào ví mã của khách (user_coupons). Mỗi khách giữ 1 dòng cho mỗi mã.
  api.claimCoupon = function (rawCode) {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var code = normalizeCouponCode(rawCode), uid = String(s.account_id);
    if (!code) return Promise.reject(fail('COUPON_EMPTY', 'Hãy nhập mã giảm giá.'));
    return TTV.Store.get('coupons', code).then(function (c) {
      if (!c) throw fail('COUPON_NOT_FOUND', 'Mã giảm giá không tồn tại.');
      if (couponExpired(c)) throw fail('COUPON_EXPIRED', 'Mã giảm giá đã hết hạn.');
      var id = userCouponId(uid, code);
      return TTV.Store.get('user_coupons', id).then(function (uc) {
        if (uc && uc.status === 'used') throw fail('COUPON_USED', 'Bạn đã dùng mã này rồi.');
        if (uc && uc.status === 'available') throw fail('COUPON_OWNED', 'Mã này đã có trong danh sách của bạn.');
        var row = { id: id, user_id: uid, coupon_code: code, status: 'available', used_order_id: '', created_at: new Date().toISOString() };
        return TTV.Store.put('user_coupons', row).then(function () { return publicCoupon(c); });
      });
    });
  };

  // Kiểm tra mã dùng được cho đơn (số tiền, số thợ). Quy tắc nằm trong pricing.js; đơn 1 thợ bị từ chối kèm lý do.
  api.checkCoupon = function (rawCode, amount, workers) {
    var code = normalizeCouponCode(rawCode);
    return Promise.all([TTV.pricing.ready(), TTV.Store.get('coupons', code)]).then(function (res) {
      var r = TTV.pricing.applyCoupon(amount, res[1], workers);
      if (res[1]) r.coupon = publicCoupon(res[1]);
      return r;
    });
  };

  // Đánh dấu mã đã dùng cho một đơn (nối vào luồng chọn thợ/thanh toán ở task sau).
  api.markCouponUsed = function (rawCode, orderId) {
    var s = customerSession();
    if (!s) return Promise.reject(fail('UNAUTH', 'Hãy đăng nhập.'));
    var id = userCouponId(s.account_id, normalizeCouponCode(rawCode));
    return TTV.Store.get('user_coupons', id).then(function (uc) {
      if (!uc) throw fail('COUPON_NOT_OWNED', 'Bạn chưa có mã này.');
      if (uc.status === 'used') throw fail('COUPON_USED', 'Mã này đã được dùng.');
      return TTV.Store.put('user_coupons', Object.assign({}, uc, { status: 'used', used_order_id: String(orderId || ''), used_at: new Date().toISOString() }));
    });
  };

  /* ===== 3.7 Nhật ký hoạt động (audit_logs) — chỉ SUPER_ADMIN, chỉ đọc ===== */
  var AUDIT_SECRET_KEY = /pass|salt|hash|otp|token|secret/i; // phòng thủ: không bao giờ trả khóa nhạy cảm ra màn hình
  function scrubAudit(v) {
    if (Array.isArray(v)) return v.map(scrubAudit);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).forEach(function (k) { if (!AUDIT_SECRET_KEY.test(k)) out[k] = scrubAudit(v[k]); });
      return out;
    }
    return v;
  }
  function parseAuditDetail(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') return scrubAudit(raw);
    try { return scrubAudit(JSON.parse(raw)); } catch (_) { return raw; }
  }
  function auditGroupOf(action) {
    var g = String(action || '').split('.')[0];
    return g === 'auth' || g === 'vendor' || g === 'settings' || g === 'customer' ? g : 'other';
  }
  api.AUDIT_GROUPS = ['auth', 'vendor', 'customer', 'settings'];
  // Trả mọi dòng nhật ký, mới nhất trước. Kèm actor_name (tra bảng staff/vendors), group, detail đã parse + loại khóa nhạy cảm.
  api.listAuditLogs = function () {
    var err = adminGuard('Bạn không có quyền xem nhật ký hoạt động.');
    if (err) return Promise.reject(err);
    if (TTV.Store.invalidate) { try { TTV.Store.invalidate(['audit_logs']); } catch (_) {} } // KIO cache 30 giây: luôn lấy bản mới
    return Promise.all([TTV.Store.list('audit_logs'), TTV.Store.list('staff'), TTV.Store.list('vendors')]).then(function (r) {
      var names = {};
      (r[1] || []).forEach(function (x) { names[String(x.id)] = x.name || x.username || ''; });
      (r[2] || []).forEach(function (x) { if (names[String(x.id)] == null) names[String(x.id)] = x.name || x.username || ''; });
      return (r[0] || []).map(function (x) {
        var actorId = String(x.actor_id == null ? '' : x.actor_id);
        return {
          id: String(x.id), action: String(x.action || ''), group: auditGroupOf(x.action),
          actor_id: actorId, actor_role: String(x.actor_role || ''), actor_name: names[actorId] || '',
          target_table: String(x.target_table || ''), target_id: String(x.target_id == null ? '' : x.target_id),
          detail: parseAuditDetail(x.detail), created_at: x.created_at || ''
        };
      }).sort(function (a, b) {
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
    });
  };

  /* ===== 8.1 Quản lý khách (admin) ===== */
  // Chỉ SUPER_ADMIN. Ví: cộng/trừ thủ công bắt buộc lý do, ghi wallet_transactions (method 'admin') + audit. Khóa: chặn đăng nhập OTP/demo + hủy phiên.
  var WALLET_ADJUST_MAX = 50000000;
  function publicCustomer(u) {
    if (!u) return null;
    return {
      id: String(u.id), phone: u.phone || '', name: u.name || '', email: u.email || '', gender: u.gender || '', dob: u.dob || '',
      avatar_path: u.avatar_path || '', login_method: u.login_method || 'phone', kyc_status: u.kyc_status || 'none',
      wallet_balance: Number(u.wallet_balance) || 0, status: u.status === 'locked' ? 'locked' : 'active',
      locked_at: u.locked_at || null, lock_reason: u.lock_reason || '', created_at: u.created_at || ''
    };
  }
  function notFoundCustomer() { return fail('NOT_FOUND', 'Không tìm thấy khách hàng.'); }
  function cleanReason(v) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' '); }

  api.listCustomers = function () {
    var err = adminGuard('Bạn không có quyền xem danh sách khách hàng.');
    if (err) return Promise.reject(err);
    return Promise.all([TTV.Store.list('users'), TTV.Store.list('orders')]).then(function (r) {
      var count = {};
      (r[1] || []).forEach(function (o) { var k = String(o.user_id); count[k] = (count[k] || 0) + 1; });
      return (r[0] || []).map(function (u) {
        var c = publicCustomer(u); c.orders_count = count[c.id] || 0; return c;
      }).sort(function (a, b) {
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return String(a.name).localeCompare(String(b.name), 'vi');
      });
    });
  };

  // Hồ sơ + đơn + ví (giao dịch gần đây) + địa chỉ + thiết bị đăng nhập. Chỉ đọc, không sửa đơn (không tự hủy đơn hết hạn).
  api.getCustomer = function (id) {
    var err = adminGuard('Bạn không có quyền xem hồ sơ khách hàng.');
    if (err) return Promise.reject(err);
    id = String(id);
    return TTV.Store.get('users', id).then(function (u) {
      if (!u) return null;
      return Promise.all([
        TTV.Store.query('orders', function (o) { return String(o.user_id) === id; }),
        TTV.Store.query('wallet_transactions', function (t) { return String(t.user_id) === id; }),
        TTV.Store.query('addresses', function (a) { return String(a.user_id) === id; }),
        TTV.Store.query('sessions', function (x) { return x.account_type === 'customer' && String(x.account_id) === id; }),
        TTV.Store.list('services')
      ]).then(function (r) {
        var names = {};
        (r[4] || []).forEach(function (x) { names[x.code || x.id] = x.name; });
        var byNew = function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); };
        var orders = (r[0] || []).slice().sort(byNew).map(function (o) {
          return {
            id: String(o.id), code: TTV.Utils.orderCode(o.id), service: o.service || '', service_name: names[o.service] || o.service || '',
            status: o.status || '', user_offer: Number(o.user_offer) || 0, final_price: o.final_price == null ? null : Number(o.final_price),
            pay_method: o.pay_method || '', workers: Number(o.workers) || 1, created_at: o.created_at || '',
            pickup: (o.pickup && o.pickup.addr) || '', dropoff: (o.dropoff && o.dropoff.addr) || ''
          };
        });
        var txs = (r[1] || []).slice().sort(byNew).map(function (t) {
          return { id: String(t.id), type: t.type || '', amount: Number(t.amount) || 0, method: t.method || '', status: t.status || '', note: t.note || '', created_at: t.created_at || '' };
        });
        var addresses = (r[2] || []).map(function (a) {
          return { id: String(a.id), label: a.label || '', type: a.type || 'other', detail: a.detail || '', contact_name: a.contact_name || '', contact_phone: a.contact_phone || '', is_default: !!a.is_default };
        }).sort(function (a, b) { return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0); });
        var devices = (r[3] || []).map(function (x) {
          return { id: String(x.id), device_name: x.device_name || '', platform: x.platform || '', last_active: x.last_active || '', created_at: x.created_at || '' };
        }).sort(function (a, b) { return String(b.last_active).localeCompare(String(a.last_active)); });
        var done = orders.filter(function (o) { return o.status === 'completed'; }).length;
        var active = orders.filter(function (o) { return o.status !== 'completed' && o.status !== 'cancelled'; }).length;
        return { customer: publicCustomer(u), orders: orders, transactions: txs, addresses: addresses, devices: devices, stats: { orders: orders.length, completed: done, active: active } };
      });
    });
  };

  // Khóa / mở khóa. Khóa: chặn đăng nhập, hủy các phiên. Gọi lại khi đã đúng trạng thái thì không ghi.
  api.setCustomerStatus = function (id, status, reason) {
    var err = adminGuard('Bạn không có quyền khóa hoặc mở khóa khách hàng.');
    if (err) return Promise.reject(err);
    if (status !== 'locked' && status !== 'active') return Promise.reject(fail('VALIDATION', 'Trạng thái không hợp lệ.'));
    reason = cleanReason(reason);
    if (reason.length > 200) return Promise.reject(fail('VALIDATION', 'Lý do tối đa 200 ký tự.'));
    return TTV.Store.get('users', String(id)).then(function (row) {
      if (!row) throw notFoundCustomer();
      if ((row.status === 'locked' ? 'locked' : 'active') === status) return row;
      var now = new Date().toISOString(), saved = Object.assign({}, row, { status: status, updated_at: now });
      if (status === 'locked') { saved.locked_at = now; saved.lock_reason = reason; } else { saved.locked_at = null; saved.lock_reason = ''; }
      return TTV.Store.put('users', saved).then(function (u) {
        var after = status === 'locked' ? dropAccountSessions('customer', u.id) : Promise.resolve();
        return after.then(function () {
          return auditSafe(status === 'locked' ? 'customer.lock' : 'customer.unlock', { target_table: 'users', target_id: u.id, detail: { name: u.name, reason: reason } });
        }).then(function () { return u; });
      });
    }).then(publicCustomer);
  };

  // Cộng / trừ ví thủ công. input = { direction:'in'|'out', amount, reason }. Lý do bắt buộc (3–200 ký tự); trừ không làm ví âm.
  api.adjustCustomerWallet = function (id, input) {
    var err = adminGuard('Bạn không có quyền chỉnh ví khách hàng.');
    if (err) return Promise.reject(err);
    input = input || {};
    var errors = {}, dir = input.direction === 'out' ? 'out' : (input.direction === 'in' ? 'in' : '');
    var raw = String(input.amount == null ? '' : input.amount).replace(/[.\s,]/g, ''), amount = /^\d+$/.test(raw) ? Number(raw) : NaN;
    var reason = cleanReason(input.reason);
    if (!dir) errors.direction = 'Chọn cộng hoặc trừ tiền.';
    if (!isFinite(amount) || amount < 1000) errors.amount = 'Số tiền tối thiểu 1.000đ (số nguyên).';
    else if (amount > WALLET_ADJUST_MAX) errors.amount = 'Số tiền tối đa ' + TTV.Utils.money(WALLET_ADJUST_MAX) + ' mỗi lần.';
    if (reason.length < 3) errors.reason = 'Lý do bắt buộc (ít nhất 3 ký tự).';
    else if (reason.length > 200) errors.reason = 'Lý do tối đa 200 ký tự.';
    if (Object.keys(errors).length) return Promise.reject(fail('VALIDATION', 'Thông tin chưa hợp lệ.', { errors: errors }));
    var admin = TTV.auth.getSession();
    return TTV.Store.get('users', String(id)).then(function (row) {
      if (!row) throw notFoundCustomer();
      return TTV.Store.get('users', row.id); // đọc lại ngay trước khi ghi
    }).then(function (fresh) {
      if (!fresh) throw notFoundCustomer();
      var before = Number(fresh.wallet_balance) || 0, after = dir === 'in' ? before + amount : before - amount;
      if (after < 0) throw fail('INSUFFICIENT', 'Số dư ví không đủ để trừ (hiện ' + TTV.Utils.money(before) + ').', { errors: { amount: 'Vượt quá số dư ví hiện tại.' } });
      var now = new Date().toISOString();
      return TTV.Store.put('users', Object.assign({}, fresh, { wallet_balance: after, updated_at: now })).then(function (u) {
        var tx = { id: TTV.Utils.id(), user_id: String(u.id), type: dir === 'in' ? 'topup' : 'payment', amount: amount, method: 'admin', status: 'success', order_id: '', note: reason, adjusted_by: admin.account_id, created_at: now };
        return TTV.Store.put('wallet_transactions', tx).then(function () {
          return auditSafe('customer.wallet_adjust', { target_table: 'users', target_id: u.id, detail: { name: u.name, direction: dir, amount: amount, balance_before: before, balance_after: after, reason: reason } });
        }).then(function () {
          background(api.pushNotification({ event: 'wallet.adjust', category: 'system', title: dir === 'in' ? 'Ví được cộng ' + TTV.Utils.money(amount) : 'Ví bị trừ ' + TTV.Utils.money(amount), body: 'Lý do: ' + reason, recipient_type: 'customer', recipient_id: String(u.id), href: '/wallet/history' }));
          return { customer: publicCustomer(u), transaction: tx };
        });
      });
    });
  };

  // Reset thiết bị: xóa mọi phiên đăng nhập của khách (đăng xuất khỏi mọi thiết bị; phiên đang mở ở tab bị hủy ở lần tải lại).
  api.resetCustomerDevices = function (id) {
    var err = adminGuard('Bạn không có quyền đặt lại thiết bị khách hàng.');
    if (err) return Promise.reject(err);
    return TTV.Store.get('users', String(id)).then(function (u) {
      if (!u) throw notFoundCustomer();
      return TTV.Store.query('sessions', function (x) { return x.account_type === 'customer' && String(x.account_id) === String(u.id); }).then(function (rows) {
        return dropAccountSessions('customer', u.id).then(function () {
          return auditSafe('customer.reset_devices', { target_table: 'users', target_id: u.id, detail: { name: u.name, removed: (rows || []).length } });
        }).then(function () { return { removed: (rows || []).length }; });
      });
    });
  };

  /* ===== 8.2 Quản lý đơn (admin) ===== */
  // Chỉ SUPER_ADMIN, CHỈ ĐỌC (can thiệp đơn: gán thợ / đổi trạng thái / hủy làm ở 8.3). Không tự hủy đơn hết hạn: chỉ gắn cờ `overdue`.
  api.ADMIN_ORDER_STATUSES = ['finding', 'matched', 'arriving', 'working', 'completed', 'cancelled'];
  function pricingReadySafe() {
    return (TTV.pricing && TTV.pricing.ready ? TTV.pricing.ready() : Promise.resolve({})).catch(function () { return {}; });
  }
  function orderIsOverdue(o, windowMs) {
    if (!o || o.status !== 'finding') return false;
    var end = quoteDeadlineMs(o, windowMs);
    return end > 0 && Date.now() >= end;
  }
  function weightNameOf(id) {
    var list = TTV.pricing && TTV.pricing.weightTiers ? TTV.pricing.weightTiers() : [], name = '';
    list.forEach(function (w) { if (String(w.id) === String(id)) name = w.name || ''; });
    return name;
  }
  function moneyOrNull(v) { return v == null || v === '' || !isFinite(Number(v)) ? null : Number(v); }

  // Danh sách mọi đơn (mới nhất trước) + danh sách dịch vụ để lọc. Lọc/tìm kiếm/phân trang làm ở màn hình.
  api.listAdminOrders = function () {
    var err = adminGuard('Bạn không có quyền xem danh sách đơn hàng.');
    if (err) return Promise.reject(err);
    if (TTV.Store.invalidate) { try { TTV.Store.invalidate(['orders', 'quotes']); } catch (_) {} } // KIO cache 30 giây: luôn lấy bản mới
    return Promise.all([
      TTV.Store.list('orders'), TTV.Store.list('users'), TTV.Store.list('vendors'),
      TTV.Store.list('services'), TTV.Store.list('quotes'), pricingReadySafe()
    ]).then(function (r) {
      var users = {}, vendors = {}, svc = {}, qTotal = {}, qPending = {};
      (r[1] || []).forEach(function (u) { users[String(u.id)] = u; });
      (r[2] || []).forEach(function (v) { vendors[String(v.id)] = v; });
      (r[3] || []).forEach(function (s) { svc[s.code || s.id] = s.name || ''; });
      (r[4] || []).forEach(function (q) {
        var k = String(q.order_id); qTotal[k] = (qTotal[k] || 0) + 1;
        if (q.status === 'pending') qPending[k] = (qPending[k] || 0) + 1;
      });
      var windowMs = TTV.pricing && TTV.pricing.quoteWindowMs ? TTV.pricing.quoteWindowMs() : 0;
      var rows = (r[0] || []).map(function (o) {
        var id = String(o.id), u = users[String(o.user_id)] || {}, v = o.vendor_id ? (vendors[String(o.vendor_id)] || {}) : null;
        return {
          id: id, code: TTV.Utils.orderCode(o.code || o.id), service: o.service || '', service_name: svc[o.service] || o.service || '',
          status: o.status || 'finding', customer_id: String(o.user_id || ''), customer_name: u.name || '', customer_phone: u.phone || '',
          vendor_id: o.vendor_id ? String(o.vendor_id) : '', vendor_name: v ? (v.name || '') : '',
          pickup: placeOf(o, 'pickup').addr, dropoff: placeOf(o, 'dropoff').addr, distance_km: Number(o.distance_km) || 0,
          workers: jobWorkers(o), speed: o.speed || 'default', pay_method: o.pay_method || '',
          user_offer: Number(o.user_offer) || 0, final_price: moneyOrNull(o.final_price),
          quotes_total: qTotal[id] || 0, quotes_pending: qPending[id] || 0,
          overdue: orderIsOverdue(o, windowMs), demo: !!o.demo, created_at: o.created_at || ''
        };
      }).sort(function (a, b) {
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
      var services = (r[3] || []).map(function (s) { return { code: s.code || s.id, name: s.name || s.code || s.id }; });
      return { orders: rows, services: services };
    });
  };

  // Chi tiết một đơn: đơn + khách + thợ + mọi báo giá (mọi trạng thái) + timeline + nhật ký sự kiện + media. null nếu không có đơn.
  api.getAdminOrder = function (id) {
    var err = adminGuard('Bạn không có quyền xem chi tiết đơn hàng.');
    if (err) return Promise.reject(err);
    id = String(id);
    if (TTV.Store.invalidate) { try { TTV.Store.invalidate(['orders', 'quotes', 'order_events', 'order_media']); } catch (_) {} }
    return TTV.Store.get('orders', id, { force: true }).then(function (o) {
      if (!o) return null;
      var same = function (x) { return String(x.order_id) === id; };
      return Promise.all([
        o.user_id ? TTV.Store.get('users', String(o.user_id)) : null,
        TTV.Store.list('vendors'), TTV.Store.list('staff'), TTV.Store.get('services', o.service),
        TTV.Store.query('quotes', same), TTV.Store.query('order_events', same), TTV.Store.query('order_media', same), pricingReadySafe()
      ]).then(function (r) {
        var u = r[0], vendors = r[1] || [], vmap = {}, smap = {}, svcRow = r[3];
        vendors.forEach(function (v) { vmap[String(v.id)] = v; });
        (r[2] || []).forEach(function (s) { smap[String(s.id)] = s.name || s.username || ''; });
        var windowMs = TTV.pricing && TTV.pricing.quoteWindowMs ? TTV.pricing.quoteWindowMs() : 0;
        var pb = o.price_breakdown || {}, pick = placeOf(o, 'pickup'), drop = placeOf(o, 'dropoff');
        var order = {
          id: String(o.id), code: TTV.Utils.orderCode(o.code || o.id), service: o.service || '', service_name: (svcRow && svcRow.name) || o.service || '',
          status: o.status || 'finding', created_at: o.created_at || '', matched_at: o.matched_at || '', completed_at: o.completed_at || '', cancelled_at: o.cancelled_at || '',
          cancel_reason: o.cancel_reason || '', quote_deadline: o.quote_deadline || '', overdue: orderIsOverdue(o, windowMs), demo: !!o.demo,
          pickup: pick, dropoff: drop, distance_km: Number(o.distance_km) || 0,
          weight_tier: o.weight_tier || '', weight_name: weightNameOf(o.weight_tier),
          pickup_floor: Number(o.pickup_floor) || 0, pickup_elevator: !!o.pickup_elevator, need_unload: o.need_unload !== false,
          drop_floor: Number(o.drop_floor) || 0, drop_elevator: !!o.drop_elevator,
          workers: jobWorkers(o), note: o.note || '', speed: o.speed || 'default', provider_type: o.provider_type || 'any', schedule_type: o.schedule_type || 'now',
          pay_method: o.pay_method || '', coupon_id: o.coupon_id || '',
          user_offer: Number(o.user_offer) || 0, current_offer: api.currentOffer(o), final_price: moneyOrNull(o.final_price), total: moneyOrNull(o.total),
          price_breakdown: { base: Number(pb.base) || 0, weight: Number(pb.weight) || 0, floor: Number(pb.floor) || 0, distance: Number(pb.distance) || 0, workers: Number(pb.workers) || 0, discount: Number(pb.discount) || 0 },
          commission_rate: moneyOrNull(o.commission_rate), commission_amount: moneyOrNull(o.commission_amount), vendor_earning: moneyOrNull(o.vendor_earning),
          cash_collected: o.cash_collected == null ? null : !!o.cash_collected, accepted_quote_id: o.accepted_quote_id ? String(o.accepted_quote_id) : ''
        };
        var customer = u ? { id: String(u.id), name: u.name || '', phone: u.phone || '', email: u.email || '', status: u.status === 'locked' ? 'locked' : 'active' }
          : (o.user_id ? { id: String(o.user_id), name: '', phone: '', email: '', status: 'active', missing: true } : null);
        var vrow = o.vendor_id ? vmap[String(o.vendor_id)] : null;
        var vendor = o.vendor_id ? {
          id: String(o.vendor_id), name: (vrow && vrow.name) || '', type: (vrow && vrow.type) || 'personal', team_size: Number(vrow && vrow.team_size) || 1,
          phone: (vrow && vrow.phone) || '', username: (vrow && vrow.username) || '', rating: Number(vrow && vrow.rating) || 0,
          jobs_done: Number(vrow && vrow.jobs_done) || 0, status: vrow && vrow.status === 'locked' ? 'locked' : 'active', missing: !vrow
        } : null;
        var quotes = (r[4] || []).map(function (q) {
          var v = vmap[String(q.vendor_id)] || {};
          return {
            id: String(q.id), vendor_id: String(q.vendor_id || ''), status: q.status || 'pending', price: Number(q.price) || 0, eta_min: Number(q.eta_min) || 0,
            message: String(q.message || ''), created_at: q.created_at || '', updated_at: q.updated_at || '', withdrawn_at: q.withdrawn_at || '',
            vendor: { name: v.name || '', type: v.type || 'personal', team_size: Number(v.team_size) || 1, rating: Number(v.rating) || 0, jobs_done: Number(v.jobs_done) || 0, phone: v.phone || '', missing: !vmap[String(q.vendor_id)] }
          };
        }).sort(function (a, b) { return (a.price - b.price) || String(a.created_at).localeCompare(String(b.created_at)); });
        var actorName = function (type, aid) {
          aid = String(aid == null ? '' : aid);
          if (type === 'customer') return (u && String(u.id) === aid && u.name) || '';
          if (type === 'vendor') return (vmap[aid] && vmap[aid].name) || '';
          if (type === 'staff' || type === 'admin') return smap[aid] || '';
          return '';
        };
        var events = (r[5] || []).map(function (e) {
          return { id: String(e.id), event: e.event || '', actor_type: e.actor_type || 'system', actor_id: String(e.actor_id == null ? '' : e.actor_id),
            actor_name: actorName(e.actor_type, e.actor_id), note: String(e.note || ''), created_at: e.created_at || '' };
        }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : (a.created_at > b.created_at ? 1 : 0); });
        var timeline = (Array.isArray(o.timeline) ? o.timeline : []).filter(function (x) { return x && x.event; })
          .map(function (x) { return { event: String(x.event), at: x.at || '' }; });
        var media = (r[6] || []).map(mapMediaRow).filter(function (m) { return m.path; }).sort(function (a, b) {
          if (a.role !== b.role) return a.role === 'proof' ? 1 : -1;
          return a.kind === b.kind ? 0 : (a.kind === 'image' ? -1 : 1);
        });
        return { order: order, customer: customer, vendor: vendor, quotes: quotes, events: events, timeline: timeline, media: media };
      });
    });
  };
})(window.TTV);
