/* Khung admin mobile-first — task 3.1. Không chứa nghiệp vụ CRUD của các task sau. */
(function (TTV) {
  'use strict';
  TTV.screens = TTV.screens || {};
  var C = TTV.Components;
  var STAFF = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];
  var MODULES = [
    { id:'customers', title:'Khách hàng', desc:'Hồ sơ, định danh và trạng thái tài khoản', icon:'♙', group:'ops', roles:['SUPER_ADMIN','ADMIN','SUPPORT'], route:'/admin/customers' },
    { id:'orders', title:'Đơn hàng', desc:'Theo dõi và hỗ trợ xử lý đơn', icon:'▣', group:'ops', roles:['SUPER_ADMIN','ADMIN','SUPPORT'], route:'/admin/orders' },
    { id:'vendors', title:'Thợ & tổ đội', desc:'Tài khoản, hồ sơ và trạng thái hoạt động', icon:'⚒', group:'ops', roles:['SUPER_ADMIN','ADMIN'], route:'/admin/vendors' },
    { id:'finance', title:'Tài chính', desc:'Giao dịch, ví và yêu cầu rút tiền', icon:'₫', group:'finance', roles:['SUPER_ADMIN','ADMIN'], route:'/admin/finance' },
    { id:'promotions', title:'Khuyến mãi', desc:'Mã giảm giá và chương trình ưu đãi', icon:'％', group:'ops', roles:['SUPER_ADMIN','ADMIN'], route:'/admin/promotions' },
    { id:'reports', title:'Báo cáo', desc:'Báo cáo do người dùng gửi và báo cáo vận hành', icon:'⚑', group:'ops', roles:STAFF, route:'/admin/reports' },
    { id:'reviews', title:'Đánh giá', desc:'Đánh giá và phản hồi sau đơn hàng', icon:'★', group:'ops', roles:STAFF, route:'/admin/reviews' },
    { id:'notifications', title:'Thông báo', desc:'Gửi thông báo tới người dùng', icon:'♧', group:'ops', roles:STAFF, route:'/admin/notifications' },
    { id:'staff', title:'Tài khoản quản trị', desc:'Tạo và quản lý ADMIN / SUPPORT', icon:'♙', group:'more', roles:['SUPER_ADMIN'], route:'/admin/staff' },
    { id:'pricing', title:'Giá & cấu hình', desc:'Đơn giá, hoa hồng và thiết lập hệ thống', icon:'⚙', group:'more', roles:['SUPER_ADMIN'], route:'/admin/settings' },
    { id:'content', title:'Nội dung ứng dụng', desc:'Banner, FAQ và chính sách', icon:'▤', group:'more', roles:['SUPER_ADMIN','ADMIN'], route:'/admin/content' },
    { id:'audit-logs', title:'Nhật ký hoạt động', desc:'Lịch sử thao tác quản trị', icon:'◷', group:'more', roles:['SUPER_ADMIN','ADMIN'], route:'/admin/audit-logs' }
  ];
  var MODULE_ROWS = {
    customers: [{name:'Danh sách khách hàng', detail:'Hồ sơ và trạng thái định danh', status:'Sắp triển khai'}],
    orders: [{name:'Danh sách đơn hàng', detail:'Trạng thái đơn và thông tin đặt dịch vụ', status:'Sắp triển khai'}],
    vendors: [{name:'Danh sách thợ / tổ đội', detail:'Tài khoản, giấy tờ và khu vực hoạt động', status:'Sắp triển khai'}],
    reports: [{name:'Báo cáo từ người dùng', detail:'Tiếp nhận và xử lý báo cáo', status:'Sắp triển khai'}],
    reviews: [{name:'Đánh giá gần đây', detail:'Nội dung đánh giá sau khi hoàn thành đơn', status:'Sắp triển khai'}],
    notifications: [{name:'Thông báo hệ thống', detail:'Mẫu và lịch sử gửi thông báo', status:'Sắp triển khai'}],
    promotions: [{name:'Mã giảm giá', detail:'Điều kiện và thời hạn áp dụng', status:'Sắp triển khai'}],
    finance: [{name:'Giao dịch và ví', detail:'Nạp tiền, thanh toán, hoàn tiền và rút tiền', status:'Sắp triển khai'}],
    staff: [{name:'Tài khoản quản trị', detail:'ADMIN và SUPPORT', status:'Sắp triển khai'}],
    settings: [{name:'Giá & cấu hình hệ thống', detail:'Đơn giá, hoa hồng và cài đặt', status:'Sắp triển khai'}],
    content: [{name:'Banner, FAQ và chính sách', detail:'Nội dung hiển thị trong ứng dụng', status:'Sắp triển khai'}],
    'audit-logs': [{name:'Nhật ký quản trị', detail:'Lịch sử thao tác và thời gian thực hiện', status:'Sắp triển khai'}]
  };
  function session() { return TTV.auth && TTV.auth.getSession ? TTV.auth.getSession() : null; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function allowed(role, module) { return module.roles.indexOf(role) >= 0; }
  function visibleModules(role) { return MODULES.filter(function (m) { return allowed(role, m); }); }
  function activeSection(path) {
    if (path === '/admin' || path === '/admin/dashboard') return 'home';
    if (path.indexOf('/admin/finance') === 0) return 'finance';
    if (path === '/admin/more' || ['/admin/staff','/admin/settings','/admin/content','/admin/audit-logs'].indexOf(path) >= 0) return 'more';
    return 'ops';
  }
  function bottomNav(path, role) {
    var active = activeSection(path), tabs = [{id:'home',label:'Tổng quan',icon:'⌂',route:'/admin'},{id:'ops',label:'Vận hành',icon:'▦',route:'/admin/operations'},{id:'finance',label:'Tài chính',icon:'₫',route:'/admin/finance'},{id:'more',label:'Thêm',icon:'•••',route:'/admin/more'}];
    return '<nav class="admin-tabbar" aria-label="Điều hướng quản trị">' + tabs.map(function (t) {
      var enabled = t.id !== 'finance' || role !== 'SUPPORT';
      return '<button class="admin-tab '+(active === t.id ? 'is-active' : '')+'" data-admin-route="'+t.route+'" '+(!enabled?'disabled aria-disabled="true"':'')+'><span class="admin-tab__icon">'+t.icon+'</span><span>'+t.label+'</span></button>';
    }).join('') + '</nav>';
  }
  function shell(path, title, body, role) {
    var s = session() || {}, name = s.name || s.account_id || 'Quản trị viên';
    var app = document.getElementById('app');
    app.classList.remove('is-wide');
    app.innerHTML = '<div class="admin-app"><header class="admin-header"><div class="admin-header__brand"><span class="admin-brand-mark">T</span><div><div class="admin-header__eyebrow">TINGTINGVAC · QUẢN TRỊ</div><h1>'+esc(title)+'</h1></div></div><button class="admin-account" data-admin-action="account" aria-label="Tài khoản">'+esc(String(name).trim().charAt(0).toUpperCase() || 'A')+'</button></header><main class="admin-content">'+body+'</main>'+bottomNav(path, role)+'</div>';
  }
  function moduleCard(m) {
    return '<button class="admin-module-card" data-admin-route="'+m.route+'"><span class="admin-module-icon">'+m.icon+'</span><span class="admin-module-copy"><strong>'+esc(m.title)+'</strong><small>'+esc(m.desc)+'</small></span><span class="admin-chevron">›</span></button>';
  }
  function dashboard(path, role) {
    var mods = visibleModules(role), shortcuts = mods.filter(function (m) { return ['customers','orders','vendors','reports'].indexOf(m.id) >= 0; }).slice(0,4);
    var body = '<section class="admin-welcome"><div class="admin-welcome__copy"><span class="admin-kicker">KHÔNG GIAN QUẢN TRỊ</span><h2>Xin chào, '+esc((session() || {}).name || 'quản trị viên')+'</h2><p>Theo dõi và điều phối hoạt động TingTingVac.</p></div><span class="admin-welcome__art">⌘</span></section>'+
      '<div class="admin-section-heading"><h2>Tổng quan</h2><span class="admin-muted">Bản khung 3.1</span></div><div class="admin-kpi-grid">'+[
        ['Đơn đang xử lý','—','▣'],['Khách hàng','—','♙'],['Thợ hoạt động','—','⚒'],['Giao dịch chờ','—','◷']
      ].map(function (k) { return '<article class="admin-kpi"><span class="admin-kpi__icon">'+k[2]+'</span><strong>'+k[1]+'</strong><span>'+k[0]+'</span></article>'; }).join('')+'</div><p class="admin-inline-note">Số liệu sẽ được kết nối với dữ liệu thật ở task 8.8.</p>'+
      '<div class="admin-section-heading"><h2>Truy cập nhanh</h2><button class="admin-text-button" data-admin-route="/admin/more">Tất cả</button></div><div class="admin-module-list">'+shortcuts.map(moduleCard).join('')+'</div>'+
      '<div class="admin-section-heading"><h2>Hoạt động gần đây</h2></div><section class="admin-empty"><span>◷</span><strong>Chưa có hoạt động để hiển thị</strong><p>Nhật ký và dữ liệu vận hành sẽ xuất hiện tại đây khi các module được triển khai.</p></section>';
    shell(path, 'Tổng quan', body, role);
  }
  function landing(path, role, mode) {
    var title = mode === 'ops' ? 'Vận hành' : mode === 'finance' ? 'Tài chính' : 'Tất cả chức năng';
    var mods = visibleModules(role).filter(function (m) { return mode === 'more' ? m.group === 'more' || ['promotions','reports','reviews','notifications'].indexOf(m.id)>=0 : mode === 'finance' ? m.group === 'finance' : m.group === 'ops'; });
    var body = '<p class="admin-page-intro">'+(mode === 'ops' ? 'Quản lý khách hàng, đơn hàng và hoạt động dịch vụ.' : mode === 'finance' ? 'Theo dõi các nghiệp vụ tài chính được cấp quyền.' : 'Các chức năng quản trị khả dụng theo vai trò của bạn.')+'</p>' + (mode === 'finance' ? '<div class="admin-kpi-grid"><article class="admin-kpi"><span class="admin-kpi__icon">₫</span><strong>—</strong><span>Giao dịch hôm nay</span></article><article class="admin-kpi"><span class="admin-kpi__icon">◷</span><strong>—</strong><span>Chờ xử lý</span></article></div><p class="admin-inline-note">Số liệu tài chính sẽ được kết nối ở các task nghiệp vụ tiếp theo.</p><div class="admin-section-heading"><h2>Phân hệ tài chính</h2></div><section class="admin-empty"><span>₫</span><strong>Chưa có dữ liệu giao dịch</strong><p>Danh sách giao dịch, ví và yêu cầu rút tiền sẽ xuất hiện tại đây khi hoàn thành module tài chính.</p></section>' : '<div class="admin-module-list">'+(mods.length ? mods.map(moduleCard).join('') : '<section class="admin-empty"><span>⌁</span><strong>Không có chức năng trong mục này</strong></section>')+'</div>');
    shell(path, title, body, role);
  }
  function listPage(path, role, mod) {
    var rows = (MODULE_ROWS[mod.id] || []).slice(), title = mod.title;
    var body = '<div class="admin-list-toolbar"><label class="admin-search"><span>⌕</span><input id="admin-list-search" type="search" placeholder="Tìm kiếm" aria-label="Tìm kiếm" autocomplete="off"></label><button class="admin-filter-button" data-admin-action="filter">☷ <span>Lọc</span></button></div><div class="admin-list-meta"><span id="admin-result-count">'+rows.length+' mục</span><span class="admin-muted">Mẫu giao diện</span></div><div id="admin-list-results" class="admin-record-list">'+renderRows(rows)+'</div><div class="admin-pagination"><button id="admin-prev" disabled>‹ Trước</button><span id="admin-page-label">Trang 1 / 1</span><button id="admin-next" disabled>Tiếp ›</button></div><p class="admin-inline-note">Đây là khung danh sách của task 3.1. Chức năng dữ liệu, tạo/sửa/xóa và bộ lọc nghiệp vụ sẽ được nối ở các task tương ứng.</p>';
    shell(path, title, body, role);
    bindList(rows);
  }
  function renderRows(rows) {
    if (!rows.length) return '<section class="admin-empty"><span>⌕</span><strong>Không tìm thấy kết quả</strong><p>Thử đổi từ khóa tìm kiếm.</p></section>';
    return rows.map(function (r) { return '<article class="admin-record"><span class="admin-record__avatar">'+esc(r.name.charAt(0))+'</span><div class="admin-record__main"><strong>'+esc(r.name)+'</strong><p>'+esc(r.detail)+'</p><span class="admin-status">'+esc(r.status)+'</span></div><button class="admin-record__more" data-admin-action="record-menu" aria-label="Tùy chọn">⋯</button></article>'; }).join('');
  }
  function bindList(rows) {
    var input = document.getElementById('admin-list-search'), results = document.getElementById('admin-list-results'), count = document.getElementById('admin-result-count');
    var prev = document.getElementById('admin-prev'), next = document.getElementById('admin-next'), label = document.getElementById('admin-page-label'), page = 0, pageSize = 5, filtered = rows.slice();
    function paint(reset) {
      if (reset) page = 0;
      var pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.max(0, Math.min(page, pages - 1));
      results.innerHTML = renderRows(filtered.slice(page * pageSize, (page + 1) * pageSize));
      count.textContent = filtered.length + ' mục'; label.textContent = 'Trang ' + (page + 1) + ' / ' + pages;
      prev.disabled = page <= 0; next.disabled = page >= pages - 1;
    }
    if (input) input.addEventListener('input', function () { var q = input.value.trim().toLocaleLowerCase('vi'); filtered = rows.filter(function (r) { return (r.name+' '+r.detail+' '+r.status).toLocaleLowerCase('vi').indexOf(q) >= 0; }); paint(true); });
    prev.addEventListener('click', function () { page--; paint(false); });
    next.addEventListener('click', function () { page++; paint(false); });
    paint(true);
  }
  function findModule(path) { return MODULES.filter(function (m) { return m.route === path; })[0] || null; }
  function render(ctx) {
    var s = session(), role = s && s.role || 'SUPPORT', path = ctx.path;
    if (path === '/admin' || path === '/admin/dashboard') return dashboard(path, role);
    if (path === '/admin/operations') return landing(path, role, 'ops');
    if (path === '/admin/finance') return landing(path, role, 'finance');
    if (path === '/admin/more') return landing(path, role, 'more');
    var mod = findModule(path);
    if (mod && allowed(role, mod)) return listPage(path, role, mod);
    TTV.Router.navigate('/admin', {replace:true});
  }
  TTV.screens.admin = { render: render, modules: MODULES };
  var routeOptions = { roles: STAFF, loginRoute:'/staff-login', deniedRoute:'/admin' };
  ['/admin','/admin/dashboard','/admin/operations','/admin/more'].forEach(function (path) { TTV.Router.add(path, render, routeOptions); });
  TTV.Router.add('/admin/finance', render, { roles:['SUPER_ADMIN','ADMIN'], loginRoute:'/staff-login', deniedRoute:'/admin' });
  MODULES.forEach(function (m) { TTV.Router.add(m.route, render, { roles:m.roles, loginRoute:'/staff-login', deniedRoute:'/admin' }); });
  document.addEventListener('click', function (e) {
    var route = e.target.closest('[data-admin-route]');
    if (route) { if (!route.disabled) TTV.Router.navigate(route.getAttribute('data-admin-route')); return; }
    var action = e.target.closest('[data-admin-action]'); if (!action) return;
    var type = action.getAttribute('data-admin-action');
    if (type === 'account') {
      var s = session() || {};
      document.body.insertAdjacentHTML('beforeend', C.sheet('Tài khoản quản trị', '<div class="admin-account-sheet"><div class="admin-account-sheet__avatar">'+esc(String(s.name || s.account_id || 'A').charAt(0).toUpperCase())+'</div><strong>'+esc(s.name || s.account_id || 'Quản trị viên')+'</strong><span>'+esc(s.role || '')+'</span><button class="btn btn-secondary btn-block" data-admin-action="change-password">Đổi mật khẩu</button><button class="btn btn-primary btn-block" data-admin-action="logout">Đăng xuất</button></div>', {footer:C.button('Đóng',{action:'admin-sheet-close',variant:'secondary'})}));
    } else if (type === 'logout') { TTV.api.logout().then(function () { document.querySelectorAll('.sheet-backdrop,.modal-backdrop').forEach(function (el) { el.remove(); }); TTV.Router.navigate('/staff-login',{replace:true}); }); }
    else if (type === 'change-password') { document.querySelectorAll('.sheet-backdrop,.modal-backdrop').forEach(function (el) { el.remove(); }); TTV.Router.navigate('/change-password'); }
    else if (type === 'filter') { document.body.insertAdjacentHTML('beforeend', C.sheet('Lọc danh sách', '<p class="admin-page-intro">Lọc theo trạng thái bản ghi.</p><div class="admin-module-list"><button class="admin-module-card" data-admin-action="filter-all"><span class="admin-module-copy"><strong>Tất cả trạng thái</strong><small>Hiển thị mọi bản ghi phù hợp từ khóa</small></span><span class="admin-chevron">›</span></button><button class="admin-module-card" data-admin-action="filter-pending"><span class="admin-module-copy"><strong>Sắp triển khai</strong><small>Các mục đang là khung giao diện</small></span><span class="admin-chevron">›</span></button></div>', {footer:C.button('Đóng',{action:'admin-sheet-close',variant:'secondary',block:true})})); }
    else if (type === 'filter-all') { document.querySelectorAll('.sheet-backdrop').forEach(function (el) { el.remove(); }); var search = document.getElementById('admin-list-search'); if (search) { search.value = ''; search.dispatchEvent(new Event('input')); } }
    else if (type === 'filter-pending') { document.querySelectorAll('.sheet-backdrop').forEach(function (el) { el.remove(); }); var search2 = document.getElementById('admin-list-search'); if (search2) { search2.value = 'Sắp triển khai'; search2.dispatchEvent(new Event('input')); } }
    else if (type === 'record-menu') C.toast('Thao tác bản ghi sẽ được bổ sung ở task quản lý tương ứng.');
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-action="admin-sheet-close"]')) document.querySelectorAll('.sheet-backdrop,.modal-backdrop').forEach(function (el) { el.remove(); }); });
})(window.TTV);
