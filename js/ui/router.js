/* Router hash: static/param/query, guard theo vai trò, 404. */
window.TTV = window.TTV || {};
(function (TTV) {
  var routes = [], notFound = null, started = false, leaveScreen = null;
  function parseHash(hash) {
    var raw = (hash || location.hash || '#/').replace(/^#/, '') || '/';
    var q = raw.indexOf('?'), path = q < 0 ? raw : raw.slice(0, q), search = q < 0 ? '' : raw.slice(q + 1);
    path = '/' + path.replace(/^\/+|\/+$/g, ''); if (path === '//') path = '/';
    var query = {};
    new URLSearchParams(search).forEach(function (v, k) { if (Object.prototype.hasOwnProperty.call(query, k)) query[k] = [].concat(query[k], v); else query[k] = v; });
    return { path: path, query: query, search: search };
  }
  function match(pattern, path) {
    var keys = [], source = String(pattern || '/').split('/').map(function (part) {
      if (part.charAt(0) === ':') { keys.push(part.slice(1)); return '([^/]+)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    var m = new RegExp('^' + source + '/?$').exec(path);
    if (!m) return null;
    var params = {}; keys.forEach(function (key, i) { try { params[key] = decodeURIComponent(m[i + 1]); } catch (_) { params[key] = m[i + 1]; } });
    return params;
  }
  function currentRole() {
    if (typeof TTV.getCurrentRole === 'function') return TTV.getCurrentRole();
    if (TTV.auth && typeof TTV.auth.getSession === 'function') { var s = TTV.auth.getSession(); return s && (s.role || s.account_type || s.accountType); }
    var s = TTV.session || null; return s && (s.role || s.account_type || s.accountType) || null;
  }
  function navigate(path, options) {
    options = options || {};
    var hash = path.charAt(0) === '#' ? path : '#' + (path.charAt(0) === '/' ? path : '/' + path);
    // replace: thay mục lịch sử hiện tại, nút Back không quay lại trang đã bị chặn.
    if (options.replace && location.replace) location.replace(location.pathname + location.search + hash);
    else location.hash = hash;
  }
  var AFTER_PLACE = 'ttv_after_place';
  function markAfterPlace(orderId) {
    try { sessionStorage.setItem(AFTER_PLACE, String(orderId || '')); } catch (_) {}
  }
  function consumeAfterPlace(orderId) {
    try {
      var cur = sessionStorage.getItem(AFTER_PLACE);
      if (!cur || String(cur) !== String(orderId || '')) return false;
      sessionStorage.removeItem(AFTER_PLACE);
      return true;
    } catch (_) { return false; }
  }

  /* ===== Guard theo vai trò (task 2.5) =====
     Mỗi khu vực khai báo tiền tố route + vai trò được vào + trang đăng nhập tương ứng.
     Route không thuộc khu nào (/, /sim/*) là công khai. Chỉ là rào cản phía trình duyệt (demo). */
  var STAFF = ['SUPER_ADMIN']; // chỉ 1 vai trò admin duy nhất
  var AREAS = [
    { name: 'customer', roles: ['CUSTOMER'], login: '/login', prefixes: ['/home', '/onboarding', '/create', '/notifications', '/address', '/orders', '/coupons', '/wallet', '/pay', '/profile', '/settings', '/payment-methods', '/reviews', '/security', '/reports', '/help', '/faq', '/policies'] },
    { name: 'vendor', roles: ['VENDOR'], login: '/staff-login', prefixes: ['/vendor'] },
    { name: 'admin', roles: STAFF, login: '/staff-login', prefixes: ['/admin'] },
    { name: 'staff', roles: STAFF.concat('VENDOR'), login: '/staff-login', prefixes: ['/change-password'] }
  ];
  var GUEST_ONLY = ['/', '/login', '/login/otp', '/staff-login']; // đã đăng nhập thì vào thẳng khu của mình
  function underPrefix(path, prefix) { return path === prefix || path.indexOf(prefix + '/') === 0; }
  function areaOf(path) {
    for (var i = 0; i < AREAS.length; i++) for (var j = 0; j < AREAS[i].prefixes.length; j++) if (underPrefix(path, AREAS[i].prefixes[j])) return AREAS[i];
    return null;
  }
  // Trang đầu tiên một phiên được phép vào (tính cả ép đổi mật khẩu / hoàn tất hồ sơ).
  function homeFor(session) {
    if (!session) return '/login';
    if (session.must_change_pw) return '/change-password';
    if (session.role === 'CUSTOMER' && TTV.api && TTV.api.sessionNeedsOnboarding && TTV.api.sessionNeedsOnboarding(session)) return '/onboarding';
    return TTV.api && TTV.api.homeRouteFor ? TTV.api.homeRouteFor(session.role) : '/home';
  }
  // Trả về null nếu được phép, hoặc { to, message } khi cần chuyển hướng.
  function checkAccess(path, session) {
    var role = session && session.role || null;
    if (GUEST_ONLY.indexOf(path) >= 0) return role ? { to: homeFor(session) } : null;
    var area = areaOf(path);
    if (!area) return null;
    if (!role) return { to: area.login };
    if (area.roles.indexOf(role) < 0) return { to: homeFor(session), message: 'Bạn không có quyền truy cập khu vực này.' };
    if (session.must_change_pw && path !== '/change-password') return { to: '/change-password' };
    if (role === 'CUSTOMER' && TTV.api && TTV.api.sessionNeedsOnboarding) {
      var needs = TTV.api.sessionNeedsOnboarding(session);
      if (needs && path !== '/onboarding') return { to: '/onboarding' };
      if (!needs && path === '/onboarding') return { to: '/home' };
    }
    return null;
  }
  function currentSession() { return TTV.auth && typeof TTV.auth.getSession === 'function' ? TTV.auth.getSession() : null; }

  function render() {
    var parsed = parseHash(), found = null, params = null;
    var denied = checkAccess(parsed.path, currentSession());
    if (denied) {
      if (typeof leaveScreen === 'function') { try { leaveScreen(); } catch (_) {} leaveScreen = null; }
      if (denied.message && TTV.Components && TTV.Components.toast) TTV.Components.toast(denied.message, 'danger');
      if (denied.to !== parsed.path) navigate(denied.to, { replace: true });
      return;
    }
    for (var i = 0; i < routes.length; i++) { var p = match(routes[i].path, parsed.path); if (p) { found = routes[i]; params = p; break; } }
    if (typeof leaveScreen === 'function') {
      try { leaveScreen(); } catch (_) {}
      leaveScreen = null;
    }
    var ctx = { path: parsed.path, query: parsed.query, params: params || {}, navigate: navigate, route: found };
    if (!found) { if (typeof notFound === 'function') return notFound(ctx); return TTV.Router.render404(ctx); }
    if (found.roles && found.roles.length) {
      var role = currentRole();
      if (!role || found.roles.indexOf(role) < 0) {
        if (typeof found.guard === 'function') return found.guard(ctx, role);
        var target = !role ? (found.loginRoute || '/staff-login') : (found.deniedRoute || '/');
        if (parsed.path !== target) navigate(target); return;
      }
    }
    if (typeof found.guard === 'function' && found.guard(ctx, currentRole()) === false) return;
    if (typeof found.handler === 'function') found.handler(ctx);
    if (typeof found.destroy === 'function') leaveScreen = found.destroy;
  }
  var api = {
    add: function (path, handler, options) { options = options || {}; routes.push({ path: path, handler: handler, roles: options.roles || null, guard: options.guard, loginRoute: options.loginRoute, deniedRoute: options.deniedRoute, destroy: options.destroy }); return api; },
    on404: function (handler) { notFound = handler; return api; },
    start: function () {
      if (started) return api;
      started = true;
      window.addEventListener('hashchange', render);
      var session = TTV.auth && typeof TTV.auth.getSession === 'function' ? TTV.auth.getSession() : null;
      var defaultRoute = session && session.role ? homeFor(session) : '/login';
      if (!location.hash || location.hash === '#/') location.hash = '#' + defaultRoute; else render();
      return api;
    },
    stop: function () { if (started) window.removeEventListener('hashchange', render); started = false; },
    render: render, navigate: navigate, parse: parseHash,
    markAfterPlace: markAfterPlace, consumeAfterPlace: consumeAfterPlace,
    has: function (path) { for (var i = 0; i < routes.length; i++) if (match(routes[i].path, path)) return true; return false; },
    checkAccess: checkAccess, homeFor: homeFor, areaOf: areaOf,
    render404: function (ctx) { var app = document.getElementById('app'); var back = homeFor(currentSession()); if (app) app.innerHTML = '<main class="page page-center"><div class="empty-state"><div class="empty-state__icon">⌕</div><h2>Không tìm thấy trang</h2><p>Đường dẫn này không tồn tại hoặc đã được thay đổi.</p><button class="btn btn-primary" data-route="' + back + '">Về trang chủ</button></div></main>'; }
  };
  TTV.Router = api;
})(window.TTV);
