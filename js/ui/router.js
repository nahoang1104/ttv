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
  function navigate(path, options) { options = options || {}; location.hash = (path.charAt(0) === '#' ? path : '#' + (path.charAt(0) === '/' ? path : '/' + path)); if (options.replace && location.replace) location.replace(location.href); }
  function render() {
    var parsed = parseHash(), found = null, params = null;
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
    start: function () { if (started) return api; started = true; window.addEventListener('hashchange', render); if (!location.hash || location.hash === '#/') location.hash = '#/home'; else render(); return api; },
    stop: function () { if (started) window.removeEventListener('hashchange', render); started = false; },
    render: render, navigate: navigate, parse: parseHash,
    render404: function (ctx) { var app = document.getElementById('app'); if (app) app.innerHTML = '<main class="page page-center"><div class="empty-state"><div class="empty-state__icon">⌕</div><h2>Không tìm thấy trang</h2><p>Đường dẫn này không tồn tại hoặc đã được thay đổi.</p><button class="btn btn-primary" data-route="/home">Về trang chủ</button></div></main>'; }
  };
  TTV.Router = api;
})(window.TTV);
