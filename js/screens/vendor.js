/* Khung app thợ — task 5.1: bottom tab 4 mục, Trang chủ (công tắc Sẵn sàng nhận đơn + thống kê hôm nay),
   và các tab Chợ đơn / Việc của tôi / Cá nhân.
   Các task sau gắn màn thật vào tab bằng:
     TTV.screens.vendor.register('market' | 'jobs', { render(box, ctx) {…}, destroy() {…} })
   (box là vùng nội dung giữa header và bottom tab; chưa đăng ký thì hiện trạng thái "sắp có"). */
window.TTV = window.TTV || {};
TTV.screens = TTV.screens || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components;
  var token = 0;          // mỗi lần vào/rời màn tăng 1; callback bất đồng bộ cũ thấy lệch token thì bỏ qua
  var docHandler = null;  // listener click gắn lên document, gỡ ở destroy
  var activePage = null;  // màn con đang gắn vào tab (market/jobs)
  var currentView = '';   // 'home' | 'market' | 'jobs' | 'profile' (để nút Thử lại vẽ lại đúng màn)
  var currentCtx = null;
  var pages = {};
  var stopLive = null;
  var stopUnread = null;
  var dashStamp = '';
  var lastDash = null;

  function t(key, params) { return TTV.I18n.t(key, params); }
  function esc(v) { return C.escape(v); }
  function app() { var el = document.getElementById('app'); el.classList.remove('is-wide'); return el; }
  function vnd(n) { return new Intl.NumberFormat('vi-VN').format(Number(n) || 0) + 'đ'; }
  function svg(inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; }

  var ICONS = {
    market: svg('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5h6v2.4H9zM8.8 11h6.4M8.8 14.6h6.4"/>'),
    jobs: svg('<rect x="4" y="8" width="16" height="11.5" rx="2"/><path d="M9 8V6.2A1.7 1.7 0 0 1 10.7 4.5h2.6A1.7 1.7 0 0 1 15 6.2V8M4 13h16"/>'),
    quote: svg('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/>'),
    wallet: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2.4"/><path d="M3.5 10h17"/>'),
    withdraw: svg('<path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>'),
    star: svg('<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.3L12 16l-4.8 2.7 1-5.3-4-3.7 5.4-.7z"/>'),
    user: svg('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    logout: svg('<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"/><path d="M14 8l4 4-4 4M18 12H9.5"/>'),
    chevron: svg('<path d="m9.5 6 6 6-6 6"/>'),
    history: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>'),
    bell: svg('<path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.4 1.5H5.1z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>')
  };

  /* ---------- Khung dùng chung ---------- */
  function tabBar(active) {
    return C.bottomTab(active, [
      { id: 'home', label: t('vendor.tab.home'), route: '/vendor' },
      { id: 'market', label: t('vendor.tab.market'), route: '/vendor/market', iconHtml: ICONS.market },
      { id: 'jobs', label: t('vendor.tab.jobs'), route: '/vendor/jobs', iconHtml: ICONS.jobs },
      { id: 'profile', label: t('vendor.tab.profile'), route: '/vendor/profile' }
    ]);
  }
  function greetingKey() {
    var h = new Date().getHours();
    if (h >= 5 && h < 11) return 'home.greet.morning';
    if (h >= 11 && h < 14) return 'home.greet.noon';
    if (h >= 14 && h < 18) return 'home.greet.afternoon';
    return 'home.greet.evening';
  }
  function typeLabel(v) {
    var list = (TTV.api.VENDOR_TYPES || []).filter(function (x) { return x.value === v.type; });
    return list.length ? list[0].label : '';
  }
  // Tài khoản bị khóa / bị xóa giữa chừng → đăng xuất về trang đăng nhập.
  function handleAuthLoss(err) {
    if (err && err.code === 'LOCKED') {
      TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.locked'), 'danger'); });
      return true;
    }
    return false;
  }
  function heroMarkup(v, opts) {
    opts = opts || {};
    var chips = [];
    var tl = typeLabel(v);
    if (tl) chips.push(tl + (Number(v.team_size) > 1 ? ' · ' + t('vendor.team', { n: v.team_size }) : ''));
    chips.push(Number(v.rating) > 0
      ? Number(v.rating).toFixed(1) + '/5 · ' + t('vendor.jobsDone', { n: Number(v.jobs_done) || 0 })
      : t('vendor.rating.none'));
    if (opts.phone && v.phone) chips.push(TTV.Utils.maskPhone(v.phone));
    var unread = TTV.NotiLive ? TTV.NotiLive.unread() : 0;
    return '<header class="vendor-hero' + (opts.flat ? ' vendor-hero--flat' : '') + '">' +
      '<div class="vendor-hero__top">' +
        '<button type="button" class="vendor-hero__bell" data-route="/vendor/notifications" aria-label="' + esc(t('vendor.notifications')) + '">' +
          ICONS.bell + TTV.Utils.unreadBadge(unread) +
        '</button>' +
      '</div>' +
      '<div class="vendor-hero__row">' +
      C.avatar(v.name, v.avatar_path, { size: 'lg' }) +
      '<div class="vendor-hero__text">' +
        (opts.greeting ? '<p class="vendor-hero__greet">' + esc(t(greetingKey())) + '</p>' : '') +
        '<h1>' + esc(v.name || t('vendor.noName')) + '</h1>' +
        '<div class="vendor-hero__meta">' + chips.map(function (c) { return '<span class="vendor-chip">' + esc(c) + '</span>'; }).join('') + '</div>' +
      '</div></div></header>';
  }
  // Ảnh đại diện lỗi → quay về chữ cái đầu.
  function bindAvatarFallback(root, name) {
    root.querySelectorAll('.vendor-hero .avatar img').forEach(function (img) {
      img.addEventListener('error', function () {
        var holder = img.parentNode; if (!holder) return;
        holder.textContent = String(name || '?').trim().charAt(0).toUpperCase() || '?';
      });
    });
  }
  function errorMarkup(title, message, active) {
    return '<div class="vendor">' + C.header(title, { back: false }) + '<main class="vendor-main">' +
      C.emptyState(title, message || t('common.error'), { icon: '!' }) +
      '<button type="button" class="btn btn-secondary btn-block" data-vendor-action="retry">' + esc(t('vendor.home.retry')) + '</button>' +
      '</main>' + tabBar(active) + '</div>';
  }

  /* ---------- Trang chủ ---------- */
  function readyMarkup(d) {
    var on = !!d.readiness.online, blocked = !!d.readiness.blocked;
    return '<section class="vendor-ready' + (on ? ' is-on' : '') + '" id="vendor-ready">' +
      '<span class="vendor-ready__dot" aria-hidden="true"></span>' +
      '<div class="vendor-ready__text"><strong id="vendor-ready-title">' + esc(t('vendor.ready.title')) + '</strong>' +
        '<span id="vendor-ready-sub">' + esc(on ? t('vendor.ready.on') : t('vendor.ready.off')) + '</span></div>' +
      '<button type="button" class="vendor-switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-labelledby="vendor-ready-title" data-vendor-action="toggle-online"' + (blocked ? ' disabled' : '') + '></button>' +
      '</section>' +
      (blocked ? C.notice(t('vendor.ready.blocked', { limit: vnd(Math.abs(d.readiness.limit)) }), t('vendor.ready.blockedTitle')) : '');
  }
  function statTile(label, value, route, key) {
    var inner = '<b' + (key ? ' data-vendor-stat="' + key + '"' : '') + '>' + esc(value) + '</b><span>' + esc(label) + '</span>';
    return route
      ? '<button type="button" class="vendor-stat" data-route="' + esc(route) + '">' + inner + '</button>'
      : '<div class="vendor-stat">' + inner + '</div>';
  }
  function crewHint(crew) {
    if (!crew) return '';
    if (crew.status === 'full') return t('vendor.crew.hint.full');
    if (crew.status === 'partial') return t('vendor.crew.hint.partial', { n: crew.free });
    return t('vendor.crew.hint.idle', { n: crew.size });
  }
  function crewMarkup(crew) {
    if (!crew) return '';
    var pct = crew.size ? Math.round(100 * crew.busy / crew.size) : 0;
    return '<section class="vendor-crew" id="vendor-crew" data-status="' + esc(crew.status) + '">' +
      '<div class="vendor-crew__head">' +
        '<strong>' + esc(t('vendor.crew.title.' + crew.kind)) + '</strong>' +
        '<span class="vendor-crew__badge">' + esc(t('vendor.crew.status.' + crew.status)) + '</span>' +
      '</div>' +
      '<div class="vendor-crew__bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<div class="vendor-crew__nums">' +
        '<div><b>' + esc(String(crew.size)) + '</b><span>' + esc(t('vendor.crew.size')) + '</span></div>' +
        '<div><b>' + esc(String(crew.busy)) + '</b><span>' + esc(t('vendor.crew.busy')) + '</span></div>' +
        '<div><b>' + esc(String(crew.free)) + '</b><span>' + esc(t('vendor.crew.free')) + '</span></div>' +
      '</div>' +
      '<p class="vendor-crew__hint">' + esc(crewHint(crew)) + '</p>' +
    '</section>';
  }
  function paintCrew(crew) {
    var box = document.getElementById('vendor-crew');
    if (!box) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = crewMarkup(crew);
    if (wrap.firstChild) box.replaceWith(wrap.firstChild);
  }
  function homeMarkup(d) {
    return '<div class="vendor vendor-home">' +
      heroMarkup(d.vendor, { greeting: true }) +
      readyMarkup(d) +
      crewMarkup(d.crew) +
      '<div class="vendor-section"><h2>' + esc(t('vendor.home.today')) + '</h2><span>' + esc(TTV.Utils.date(d.today.date)) + '</span></div>' +
      '<div class="vendor-stats">' +
        statTile(t('vendor.stat.completed'), String(d.today.completed)) +
        statTile(t('vendor.stat.earnings'), vnd(d.today.earnings)) +
      '</div>' +
      '<div class="vendor-section"><h2>' + esc(t('vendor.home.ongoing')) + '</h2></div>' +
      '<div class="vendor-stats">' +
        statTile(t('vendor.stat.quotes'), String(d.ongoing.pendingQuotes), '', 'quotes') +
        statTile(t('vendor.stat.jobs'), String(d.ongoing.activeJobs), '/vendor/jobs', 'jobs') +
      '</div>' +
      '<div class="vendor-cta"><button type="button" class="btn btn-primary btn-block" data-route="/vendor/market">' + esc(t('vendor.home.cta')) + '</button></div>' +
      tabBar('home') +
      '</div>';
  }
  function renderHome() {
    destroyAll();
    currentView = 'home';
    var my = ++token, root = app();
    root.innerHTML = C.loading(t('common.loading'));
    TTV.api.getVendorDashboard({ poll: !!dashStamp, since: dashStamp }).then(function (d) {
      if (my !== token) return;
      if (d && d.unchanged && lastDash) d = lastDash;
      else {
        lastDash = d;
        if (d && d.stamp) dashStamp = d.stamp;
      }
      root.innerHTML = homeMarkup(d);
      bindAvatarFallback(root, d.vendor.name);
      bindCommon();
      stopUnread = TTV.Utils.watchUnread(root);
      if (TTV.Live && TTV.Live.watch) {
        stopLive = TTV.Live.watch('orders', function () {
          TTV.api.getVendorDashboard({ poll: true, since: dashStamp }).then(function (next) {
            if (currentView !== 'home') return;
            if (next && next.unchanged) return;
            lastDash = next;
            if (next && next.stamp) dashStamp = next.stamp;
            var q = root.querySelector('[data-vendor-stat="quotes"]');
            var j = root.querySelector('[data-vendor-stat="jobs"]');
            if (q) q.textContent = String(next.ongoing.pendingQuotes);
            if (j) j.textContent = String(next.ongoing.activeJobs);
            if (next.crew) paintCrew(next.crew);
          }).catch(function () {});
        }, { immediate: false });
      }
    }).catch(function (err) {
      if (my !== token) return;
      if (handleAuthLoss(err)) return;
      root.innerHTML = errorMarkup(t('vendor.home.loadError'), err && err.message, 'home');
      bindCommon();
    });
  }
  function paintReady(on) {
    var card = document.getElementById('vendor-ready'); if (!card) return;
    card.classList.toggle('is-on', on);
    var sw = card.querySelector('.vendor-switch'); if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
    var sub = document.getElementById('vendor-ready-sub'); if (sub) sub.textContent = on ? t('vendor.ready.on') : t('vendor.ready.off');
  }
  function onToggle(btn) {
    if (btn.disabled) return;
    var next = btn.getAttribute('aria-checked') !== 'true';
    btn.disabled = true; // chặn bấm liên tiếp trong lúc ghi
    TTV.api.setVendorOnline(next).then(function (v) {
      if (!document.body.contains(btn)) return; // đã rời màn
      paintReady(!!v.is_online);
      C.toast(t(v.is_online ? 'vendor.ready.turnedOn' : 'vendor.ready.turnedOff'), 'success');
    }).catch(function (err) {
      if (handleAuthLoss(err)) return;
      if (err && err.code === 'WALLET_NEGATIVE') { renderHome(); } // vẽ lại để hiện khung cảnh báo + khóa công tắc
      C.toast((err && err.message) || t('common.error'), 'danger');
    }).then(function () {
      if (document.body.contains(btn)) btn.disabled = false; // (đã vẽ lại hoặc rời màn thì nút không còn trong DOM)
    });
  }

  /* ---------- Tab Chợ đơn / Việc của tôi (khung; màn thật gắn ở task sau) ---------- */
  function renderTab(id, ctx) {
    destroyAll();
    currentView = id; currentCtx = ctx || null;
    ++token;
    var root = app();
    var unread = TTV.NotiLive ? TTV.NotiLive.unread() : 0;
    root.innerHTML = '<div class="vendor">' +
      '<header class="app-header"><h1>' + esc(t('vendor.tab.' + id)) + '</h1>' +
        '<button type="button" class="app-header__action vendor-hero__bell" data-route="/vendor/notifications" aria-label="' + esc(t('vendor.notifications')) + '">' +
          ICONS.bell + TTV.Utils.unreadBadge(unread) +
        '</button></header>' +
      '<main class="vendor-main" id="vendor-page"></main>' + tabBar(id) + '</div>';
    var box = root.querySelector('#vendor-page'), page = pages[id];
    bindCommon();
    stopUnread = TTV.Utils.watchUnread(root);
    if (page && typeof page.render === 'function') { activePage = page; page.render(box, ctx); }
    else box.innerHTML = C.emptyState(t('vendor.' + id + '.soon'), t('vendor.' + id + '.soon.desc'), { icon: id === 'market' ? '▤' : '☑' });
  }

  /* ---------- Tab Cá nhân ---------- */
  var MENU = [
    { title: 'vendor.profile.section.activity', items: [
      { icon: 'bell', label: 'vendor.notifications', route: '/vendor/notifications' },
      { icon: 'quote', label: 'vendor.profile.quotes', route: '/vendor/quotes' },
      { icon: 'history', label: 'vendor.profile.history', route: '/vendor/history' },
      { icon: 'wallet', label: 'vendor.profile.wallet', route: '/vendor/wallet' },
      { icon: 'withdraw', label: 'vendor.profile.withdraw', route: '/vendor/withdrawals' },
      { icon: 'star', label: 'vendor.profile.reviews', route: '/vendor/reviews' }
    ] },
    { title: 'vendor.profile.section.account', items: [
      { icon: 'user', label: 'vendor.profile.info', route: '/vendor/info' },
      { icon: 'lock', label: 'vendor.profile.password', route: '/change-password' }
    ] }
  ];
  function menuRow(item) {
    var ready = TTV.Router.has(item.route); // route nào đã có màn thì tự sáng lên, không phải sửa file này
    return '<button type="button" class="menu-row' + (ready ? '' : ' is-soon') + '" data-menu-route="' + esc(item.route) + '">' +
      '<span class="menu-row__icon">' + ICONS[item.icon] + '</span>' +
      '<span class="menu-row__label">' + esc(t(item.label)) + '</span>' +
      (ready ? '' : '<span class="menu-row__soon">' + esc(t('common.comingSoon')) + '</span>') +
      '<span class="menu-row__chev">' + ICONS.chevron + '</span></button>';
  }
  function profileMarkup(v) {
    return '<div class="vendor vendor-profile">' +
      heroMarkup(v, { flat: true, phone: true }) +
      MENU.map(function (sec) {
        return '<h2 class="profile-section">' + esc(t(sec.title)) + '</h2><div class="menu-card">' + sec.items.map(menuRow).join('') + '</div>';
      }).join('') +
      '<button type="button" class="btn-logout" data-vendor-action="logout">' + ICONS.logout + '<span>' + esc(t('vendor.profile.logout')) + '</span></button>' +
      tabBar('profile') +
      '</div>';
  }
  function renderProfile() {
    destroyAll();
    currentView = 'profile';
    var my = ++token, root = app();
    root.innerHTML = C.loading(t('common.loading'));
    TTV.api.getVendorSelf().then(function (v) {
      if (my !== token) return;
      root.innerHTML = profileMarkup(v);
      bindAvatarFallback(root, v.name);
      bindCommon();
      stopUnread = TTV.Utils.watchUnread(root);
    }).catch(function (err) {
      if (my !== token) return;
      if (handleAuthLoss(err)) return;
      root.innerHTML = errorMarkup(t('vendor.profile.loadError'), err && err.message, 'profile');
      bindCommon();
    });
  }
  function confirmLogout() {
    document.body.insertAdjacentHTML('beforeend', C.modal(t('vendor.profile.logout'), '<p>' + esc(t('vendor.profile.logout.confirm')) + '</p>', {
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>' + esc(t('common.cancel')) + '</button>' +
        '<button type="button" class="btn btn-danger" data-vendor-action="logout-confirm">' + esc(t('vendor.profile.logout')) + '</button>'
    }));
  }

  /* ---------- Sự kiện, dọn dẹp, đăng ký route ---------- */
  function rerender() {
    if (currentView === 'home') renderHome();
    else if (currentView === 'profile') renderProfile();
    else renderTab(currentView, currentCtx);
  }
  function bindCommon() {
    if (docHandler) document.removeEventListener('click', docHandler);
    docHandler = function (e) {
      var menu = e.target.closest('[data-menu-route]');
      if (menu) {
        var route = menu.getAttribute('data-menu-route');
        if (TTV.Router.has(route)) TTV.Router.navigate(route); else C.toast(t('vendor.profile.soon.toast'), 'info');
        return;
      }
      var el = e.target.closest('[data-vendor-action]'); if (!el) return;
      var action = el.getAttribute('data-vendor-action');
      if (action === 'toggle-online') onToggle(el);
      else if (action === 'retry') rerender();
      else if (action === 'logout') confirmLogout();
      else if (action === 'logout-confirm') {
        var overlay = el.closest('.modal-backdrop'); if (overlay) overlay.remove();
        TTV.api.logoutAndGo().then(function () { C.toast(t('vendor.profile.logout.done'), 'success'); });
      }
    };
    document.addEventListener('click', docHandler);
  }
  function destroyAll() {
    token++; // vô hiệu mọi callback đang chờ
    if (stopLive) { stopLive(); stopLive = null; }
    if (stopUnread) { stopUnread(); stopUnread = null; }
    if (docHandler) { document.removeEventListener('click', docHandler); docHandler = null; }
    if (activePage && typeof activePage.destroy === 'function') { try { activePage.destroy(); } catch (_) {} }
    activePage = null;
    var m = document.querySelector('.modal-backdrop'); if (m) m.remove();
  }

  TTV.screens.vendor = {
    pages: pages,
    register: function (id, page) { pages[id] = page; },
    destroy: destroyAll
  };

  var opts = { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: destroyAll };
  TTV.Router.add('/vendor', renderHome, opts);
  TTV.Router.add('/vendor/notifications', function () {
    destroyAll();
    TTV.screens.notifications.render(app());
  }, { roles: ['VENDOR'], loginRoute: '/staff-login', deniedRoute: '/staff-login', destroy: function () {
    TTV.screens.notifications.destroy();
  } });
  TTV.Router.add('/vendor/market', function (ctx) { renderTab('market', ctx); }, opts);
  TTV.Router.add('/vendor/jobs', function (ctx) { renderTab('jobs', ctx); }, opts);
  TTV.Router.add('/vendor/profile', renderProfile, opts);
})(window.TTV);
