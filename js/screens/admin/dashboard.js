/* screens/admin/dashboard.js — Dashboard khung #/admin (task 3.8).
   Chỉ SUPER_ADMIN (guard do admin.js đăng ký route). Đây là KHUNG: các thẻ số liệu, biểu đồ, danh sách "cần xử lý"
   đã có bố cục + trạng thái đang tải / lỗi, nhưng giá trị để "—" cho tới task 8.8.
   Nối dữ liệu thật ở 8.8: định nghĩa `TTV.api.getAdminDashboard(range)` trả Promise<object> theo khóa `id` của METRICS
   (ví dụ { orders_today: 12, gmv: 3500000, match_rate: 0.82 }) và `series` cho biểu đồ — KHÔNG phải sửa file này. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  TTV.screens = TTV.screens || {};
  var C = TTV.Components, esc = C.escape;
  function t(key, params) { return TTV.I18n.t(key, params); }

  /* kind: count | money | percent. route: màn chi tiết khi bấm thẻ (route chưa có thì router tự về 404/dashboard). */
  var METRICS = [
    { id: 'orders_today', kind: 'count', icon: '▣', route: '/admin/orders' },
    { id: 'orders_active', kind: 'count', icon: '◔', route: '/admin/orders' },
    { id: 'gmv', kind: 'money', icon: '₫', route: '/admin/finance' },
    { id: 'commission', kind: 'money', icon: '％', route: '/admin/finance' },
    { id: 'new_customers', kind: 'count', icon: '♙', route: '/admin/customers' },
    { id: 'vendors_online', kind: 'count', icon: '⚒', route: '/admin/vendors' },
    { id: 'match_rate', kind: 'percent', icon: '✓', route: '/admin/orders' },
    { id: 'orders_unmatched', kind: 'count', icon: '⚠', route: '/admin/orders', tone: 'warn' }
  ];
  /* Việc cần xử lý — danh sách dòng bấm được. */
  var TODO = [
    { id: 'withdrawals_pending', icon: '₫', route: '/admin/finance' },
    { id: 'topups_pending', icon: '◷', route: '/admin/finance' },
    { id: 'reports_new', icon: '⚑', route: '/admin/reports' }
  ];
  var RANGES = ['today', '7d', '30d'];
  var CHART_MODES = ['day', 'week'];

  var token = 0;      // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var host = null;    // vùng nội dung của khung admin
  var state = null;   // { range, chart, data, status: loading|ready|error }

  function session() { return TTV.auth && TTV.auth.getSession ? TTV.auth.getSession() : null; }

  /* ===================== Định dạng ===================== */
  function fmt(kind, v) {
    if (v == null || v === '' || !isFinite(Number(v))) return '—';
    v = Number(v);
    if (kind === 'money') return TTV.Utils.money(v);
    if (kind === 'percent') return (Math.round(v * 1000) / 10).toLocaleString('vi-VN') + '%';
    return v.toLocaleString('vi-VN');
  }

  /* ===================== Tải dữ liệu ===================== */
  // Khung: chưa có API thì trả {} (mọi thẻ hiện "—"). 8.8 chỉ cần thêm TTV.api.getAdminDashboard.
  function loadMetrics(range) {
    var api = TTV.api;
    if (api && typeof api.getAdminDashboard === 'function') return Promise.resolve(api.getAdminDashboard(range));
    return Promise.resolve({});
  }
  function load(myToken, keep) {
    var prev = state || {};
    state = { range: (keep && keep.range) || prev.range || 'today', chart: (keep && keep.chart) || prev.chart || 'day', data: null, status: 'loading' };
    paintMetrics();
    var range = state.range;
    loadMetrics(range).then(function (data) {
      if (myToken !== token || !state || state.range !== range) return;
      state.data = data || {}; state.status = 'ready'; paintMetrics();
    }).catch(function () {
      if (myToken !== token || !state || state.range !== range) return;
      state.status = 'error'; paintMetrics();
    });
  }

  /* ===================== Vẽ ===================== */
  function chip(attr, value, text, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(text) + '</button>';
  }
  function kpiCard(m) {
    var loading = state.status === 'loading';
    var val = loading ? '<span class="admin-skel admin-skel--value" aria-hidden="true"></span>' : '<strong>' + esc(fmt(m.kind, state.data && state.data[m.id])) + '</strong>';
    return '<button type="button" class="admin-kpi admin-kpi--link' + (m.tone ? ' admin-kpi--' + m.tone : '') + '" data-admin-route="' + esc(m.route) + '">' +
      '<span class="admin-kpi__icon">' + m.icon + '</span>' + val + '<span>' + esc(t('adminDash.m.' + m.id)) + '</span></button>';
  }
  function todoRow(r) {
    var loading = state.status === 'loading', n = state.data && state.data[r.id];
    var badge = loading ? '<span class="admin-skel admin-skel--badge" aria-hidden="true"></span>'
      : '<span class="admin-todo__count' + (Number(n) > 0 ? ' is-hot' : '') + '">' + esc(fmt('count', n)) + '</span>';
    return '<button type="button" class="admin-module-card admin-todo" data-admin-route="' + esc(r.route) + '"><span class="admin-module-icon">' + r.icon + '</span>' +
      '<span class="admin-module-copy"><strong>' + esc(t('adminDash.todo.' + r.id)) + '</strong><small>' + esc(t('adminDash.todo.' + r.id + '.desc')) + '</small></span>' + badge + '<span class="admin-chevron">›</span></button>';
  }
  /* Biểu đồ khung: 7 cột rỗng; có series thật (mảng số) thì vẽ chiều cao theo giá trị. */
  function chartBlock() {
    var series = state.data && state.data['series_' + state.chart];
    var has = Array.isArray(series) && series.length;
    var max = has ? Math.max.apply(null, series.concat([1])) : 1;
    var n = has ? series.length : 7, bars = '';
    for (var i = 0; i < n; i++) {
      var h = has ? Math.max(4, Math.round((Number(series[i]) || 0) / max * 100)) : 14 + ((i * 37) % 30);
      bars += '<span class="admin-bar' + (has ? '' : ' is-empty') + '" style="height:' + h + '%"></span>';
    }
    var note = state.status === 'loading' ? '' : (has ? '' : '<p class="admin-chart__note">' + esc(t('adminDash.chart.empty')) + '</p>');
    return '<div class="admin-chart-card"><div class="admin-chart-head"><strong>' + esc(t('adminDash.chart.title')) + '</strong><div class="admin-segment" role="group">' +
      CHART_MODES.map(function (m) { return '<button type="button" class="admin-segment__btn' + (state.chart === m ? ' is-on' : '') + '" data-ad-chart="' + m + '" aria-pressed="' + (state.chart === m) + '">' + esc(t('adminDash.chart.' + m)) + '</button>'; }).join('') +
      '</div></div><div class="admin-bars' + (state.status === 'loading' ? ' is-loading' : '') + '" aria-hidden="true">' + bars + '</div>' + note + '</div>';
  }
  function errorBlock() {
    return '<section class="admin-empty"><span>⚠</span><strong>' + esc(t('adminDash.loadError')) + '</strong><p>' + esc(t('adminDash.loadError.desc')) + '</p>' +
      '<button type="button" class="btn btn-secondary" data-ad-retry>' + esc(t('adminDash.retry')) + '</button></section>';
  }
  function paintMetrics() {
    var box = host && host.querySelector('#ad-metrics');
    if (!box || !state) return;
    if (state.status === 'error') { box.innerHTML = errorBlock(); return; }
    box.innerHTML =
      '<div class="admin-chip-row" role="group" aria-label="' + esc(t('adminDash.range.label')) + '">' +
        RANGES.map(function (r) { return chip('data-ad-range', r, t('adminDash.range.' + r), state.range === r); }).join('') + '</div>' +
      '<div class="admin-section-heading"><h2>' + esc(t('adminDash.overview')) + '</h2><span class="admin-muted">' + esc(t('adminDash.range.' + state.range)) + '</span></div>' +
      '<div class="admin-kpi-grid">' + METRICS.map(kpiCard).join('') + '</div>' +
      (state.status === 'ready' && !hasAny() ? '<p class="admin-inline-note">' + esc(t('adminDash.note')) + '</p>' : '') +
      '<div class="admin-section-heading"><h2>' + esc(t('adminDash.todo.title')) + '</h2></div><div class="admin-module-list">' + TODO.map(todoRow).join('') + '</div>' +
      '<div class="admin-section-heading"><h2>' + esc(t('adminDash.chart.heading')) + '</h2></div>' + chartBlock();
  }
  function hasAny() {
    var d = state.data || {};
    return METRICS.concat(TODO).some(function (m) { return d[m.id] != null; });
  }

  function render(ctx, helpers) {
    token++;
    var s = session() || {}, role = s.role || '';
    var shortcuts = TTV.screens.admin.modules.filter(function (m) { return ['customers', 'orders', 'vendors', 'reports'].indexOf(m.id) >= 0 && m.roles.indexOf(role) >= 0; });
    var body = '<section class="admin-welcome"><div class="admin-welcome__copy"><span class="admin-kicker">' + esc(t('adminDash.kicker')) + '</span><h2>' + esc(t('adminDash.hello', { name: s.name || t('adminDash.admin') })) + '</h2><p>' + esc(t('adminDash.sub')) + '</p></div><span class="admin-welcome__art">⌘</span></section>' +
      '<div id="ad-metrics"></div>' +
      '<div class="admin-section-heading"><h2>' + esc(t('adminDash.quick')) + '</h2><button class="admin-text-button" data-admin-route="/admin/more">' + esc(t('adminDash.all')) + '</button></div>' +
      '<div class="admin-module-list">' + shortcuts.map(helpers.moduleCard).join('') + '</div>' +
      '<div class="admin-section-heading"><h2>' + esc(t('adminDash.recent')) + '</h2></div>' +
      '<section class="admin-empty"><span>◷</span><strong>' + esc(t('adminDash.recent.empty')) + '</strong><p>' + esc(t('adminDash.recent.desc')) + '</p></section>';
    helpers.shell(ctx.path, t('adminDash.title'), body, role);
    host = document.querySelector('.admin-content');
    state = null;
    load(token);
  }

  /* ===================== Sự kiện ===================== */
  function onClick(e) {
    var target = e.target, el;
    if (!target || !target.closest || !host || !host.contains(target)) return;
    if (target.closest('[data-ad-retry]')) { load(token); return; }
    if ((el = target.closest('[data-ad-range]'))) { if (state && state.range !== el.getAttribute('data-ad-range')) load(token, { range: el.getAttribute('data-ad-range') }); return; }
    if ((el = target.closest('[data-ad-chart]'))) { if (state) { state.chart = el.getAttribute('data-ad-chart'); paintMetrics(); } }
  }
  document.addEventListener('click', onClick);

  function destroy() { token++; state = null; host = null; }

  TTV.screens.adminDashboard = { render: render, destroy: destroy, METRICS: METRICS, fmt: fmt };
})(window.TTV);
