/* screens/admin/orders.js — Quản lý đơn (task 8.2): #/admin/orders, #/admin/orders/:id.
   Chỉ SUPER_ADMIN, CHỈ ĐỌC (gán thợ / đổi trạng thái / hủy + hoàn tiền làm ở 8.3).
   Danh sách: tìm kiếm + lọc trạng thái / dịch vụ / ngày đặt (làm phía trình duyệt trên dữ liệu api.listAdminOrders).
   Chi tiết chia 3 tab chip: Chi tiết · Báo giá · Tiến trình (timeline + nhật ký sự kiện). Khung mobile 430px, không sidebar. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var C = TTV.Components, esc = C.escape;
  TTV.screens = TTV.screens || {};
  function t(key, params) { return TTV.I18n.t(key, params); }

  var LIST = '/admin/orders', PAGE_SIZE = 8, TABS = ['info', 'quotes', 'timeline'];
  var STATUSES = ['finding', 'matched', 'arriving', 'working', 'completed', 'cancelled'];
  var STEPS = ['created', 'matched', 'arriving', 'working', 'completed'];
  var STATUS_BADGE = { finding: 'warning', matched: 'info', arriving: 'info', working: 'info', completed: 'success', cancelled: 'neutral' };
  var QUOTE_BADGE = { pending: 'warning', accepted: 'success', rejected: 'neutral', withdrawn: 'neutral', expired: 'neutral' };
  var token = 0;       // tăng mỗi lần vào/rời màn để bỏ qua kết quả bất đồng bộ cũ
  var host = null;     // vùng nội dung của khung admin
  var list = null;     // { all, services, q, status, service, range, from, to, page }
  var detail = null;   // { id, data, tab }

  /* ===================== Tiện ích ===================== */
  function fold(v) { // không phân biệt hoa thường và dấu tiếng Việt
    return String(v == null ? '' : v).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }
  function msg(e) { return (e && e.message) || t('adminOrd.err.generic'); }
  function money(n) { return TTV.Utils.money(n || 0); }
  function when(iso, withSeconds) {
    if (!iso) return '—';
    var o = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    if (withSeconds) o.second = '2-digit';
    return TTV.Utils.date(iso, o) || '—';
  }
  function km(n) { return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1).replace('.', ',') + ' km'; }
  function none() { return esc(t('adminOrd.none')); }
  function chip(attr, value, label, on) {
    return '<button type="button" class="chip' + (on ? ' is-selected' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }
  function emptyBlock(icon, title, desc) { return '<section class="admin-empty"><span>' + icon + '</span><strong>' + esc(title) + '</strong><p>' + esc(desc) + '</p></section>'; }
  function kv(label, valueHtml) { return '<div class="admin-kv__row"><dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd></div>'; }
  function goTo(path) { TTV.Router.navigate(path); }
  function labelOr(key, fallback) { var s = t(key); return s === key ? fallback : s; }
  function statusBadge(st) { return C.badge(labelOr('adminOrd.st.' + st, st || '—'), STATUS_BADGE[st] || 'neutral'); }
  function setSelected(root, attr, value) {
    root.querySelectorAll('[' + attr + ']').forEach(function (b) {
      var on = b.getAttribute(attr) === value;
      b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ===================== Danh sách ===================== */
  function parseDay(v) { // 'YYYY-MM-DD' → mốc 0 giờ (giờ máy), NaN nếu sai/không có
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
    if (!m) return NaN;
    var y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]), x = new Date(y, mo, d);
    return x.getFullYear() === y && x.getMonth() === mo && x.getDate() === d ? x.getTime() : NaN;
  }
  function daysAgoStart(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime(); }
  function dateInvalid() {
    if (list.range !== 'custom') return false;
    var a = parseDay(list.from), b = parseDay(list.to);
    return isFinite(a) && isFinite(b) && a > b;
  }
  function dateBounds() { // [từ (gồm), đến (không gồm)); khoảng sai thì bỏ qua lọc ngày
    var lo = -Infinity, hi = Infinity;
    if (list.range === 'today') lo = daysAgoStart(0);
    else if (list.range === '7d') lo = daysAgoStart(6);
    else if (list.range === '30d') lo = daysAgoStart(29);
    else if (list.range === 'custom' && !dateInvalid()) {
      var a = parseDay(list.from), b = parseDay(list.to);
      if (isFinite(a)) lo = a;
      if (isFinite(b)) { var e = new Date(b); e.setDate(e.getDate() + 1); hi = e.getTime(); }
    }
    return [lo, hi];
  }
  function matchesBase(r, b) { // mọi bộ lọc trừ trạng thái (để đếm số lượng theo từng trạng thái)
    if (list.service !== 'all' && r.service !== list.service) return false;
    if (b[0] !== -Infinity || b[1] !== Infinity) {
      var ts = Date.parse(r.created_at);
      if (!isFinite(ts) || ts < b[0] || ts >= b[1]) return false;
    }
    var q = fold(list.q).trim().replace(/^#/, '');
    if (!q) return true;
    if (r._hay.indexOf(q) >= 0) return true;
    var digits = q.replace(/\D/g, ''); // tìm SĐT khách không phân biệt dấu cách / dấu chấm / +84
    if (digits.length < 3) return false;
    var ph = String(r.customer_phone || '').replace(/\D/g, '');
    return ph.indexOf(digits) >= 0 || ph.indexOf(digits.replace(/^0/, '84')) >= 0 || ('0' + ph.replace(/^84/, '')).indexOf(digits) >= 0;
  }
  function filtersActive() { return !!(fold(list.q).trim() || list.status !== 'all' || list.service !== 'all' || list.range !== 'all'); }

  function statusChips(base) {
    var n = { all: base.length };
    STATUSES.forEach(function (s) { n[s] = 0; });
    base.forEach(function (r) { if (n[r.status] != null) n[r.status]++; });
    return ['all'].concat(STATUSES).map(function (k) { return chip('data-ol-status', k, t('adminOrd.st.' + k) + ' (' + n[k] + ')', list.status === k); }).join('');
  }
  function serviceChips() {
    return chip('data-ol-service', 'all', t('adminOrd.filter.allServices'), list.service === 'all') +
      list.services.map(function (s) { return chip('data-ol-service', s.code, s.name, list.service === s.code); }).join('');
  }
  function rangeChips() {
    return ['all', 'today', '7d', '30d', 'custom'].map(function (k) { return chip('data-ol-range', k, t('adminOrd.date.' + k), list.range === k); }).join('');
  }
  function recordHtml(r) {
    var who = [];
    who.push(t('adminOrd.row.customer', { name: r.customer_name || t('adminOrd.noName') }));
    if (r.vendor_id) who.push(t('adminOrd.row.vendor', { name: r.vendor_name || t('adminOrd.noName') }));
    var price = r.final_price != null ? money(r.final_price) : '≤ ' + money(r.user_offer);
    var badges = statusBadge(r.status) + (r.overdue ? C.badge(t('adminOrd.overdue'), 'danger') : '') + (r.demo ? C.badge(t('adminOrd.demo'), 'neutral') : '') +
      C.badge(price, 'neutral') + C.badge(t('adminOrd.workers', { n: r.workers }), 'info') +
      (r.status === 'finding' || r.quotes_total ? C.badge(t('adminOrd.quotesN', { n: r.quotes_total }), r.quotes_pending ? 'warning' : 'neutral') : '');
    return '<article class="admin-record admin-record--link" role="link" tabindex="0" data-ol-open="' + esc(r.id) + '">' +
      '<span class="admin-record__avatar">▣</span>' +
      '<div class="admin-record__main"><strong>' + esc(r.service_name || t('adminOrd.none')) + ' · ' + esc(r.code) + '</strong>' +
      '<p>' + esc(r.pickup || '—') + ' → ' + esc(r.dropoff || '—') + '</p>' +
      '<p class="admin-muted">' + esc(who.join(' · ')) + '</p>' +
      '<div class="admin-record__badges">' + badges + '</div>' +
      '<p class="admin-muted">' + esc(when(r.created_at)) + '</p></div>' +
      '<span class="admin-record__chev" aria-hidden="true">›</span></article>';
  }
  function listShell() {
    return '<div class="admin-list-toolbar"><label class="admin-search"><span>⌕</span><input id="ol-search" type="search" placeholder="' + esc(t('adminOrd.search')) + '" aria-label="' + esc(t('adminOrd.search')) + '" autocomplete="off" value="' + esc(list.q) + '"></label></div>' +
      '<div class="admin-chip-row" id="ol-status-row" role="group" aria-label="' + esc(t('adminOrd.st.all')) + '"></div>' +
      '<div class="admin-chip-row" id="ol-service-row" role="group" aria-label="' + esc(t('adminOrd.filter.service')) + '"></div>' +
      '<div class="admin-chip-row" id="ol-range-row" role="group" aria-label="' + esc(t('adminOrd.filter.date')) + '"></div>' +
      '<div id="ol-custom" hidden><div class="admin-date-range">' +
      '<label><span>' + esc(t('adminOrd.date.from')) + '</span><input type="date" id="ol-from" value="' + esc(list.from) + '"></label>' +
      '<label><span>' + esc(t('adminOrd.date.to')) + '</span><input type="date" id="ol-to" value="' + esc(list.to) + '"></label></div>' +
      '<p class="admin-date-error" id="ol-date-error" role="alert" hidden>' + esc(t('adminOrd.date.invalid')) + '</p></div>' +
      '<div class="admin-list-meta"><span id="ol-count"></span><span class="admin-list-meta__actions">' +
      '<button type="button" class="admin-text-button" id="ol-clear" data-ol-clear hidden>' + esc(t('adminOrd.clear')) + '</button>' +
      '<button type="button" class="admin-text-button" data-ol-refresh>' + esc(t('adminOrd.refresh')) + '</button></span></div>' +
      '<div id="ol-results" class="admin-record-list"></div>' +
      '<div class="admin-pagination" id="ol-pager"><button type="button" data-ol-page="-1" id="ol-prev">' + esc(t('adminOrd.prev')) + '</button><span id="ol-page-label"></span><button type="button" data-ol-page="1" id="ol-next">' + esc(t('adminOrd.next')) + '</button></div>';
  }
  function paintChips(base) {
    host.querySelector('#ol-status-row').innerHTML = statusChips(base);
    host.querySelector('#ol-service-row').innerHTML = serviceChips();
    host.querySelector('#ol-range-row').innerHTML = rangeChips();
    host.querySelector('#ol-custom').hidden = list.range !== 'custom';
    host.querySelector('#ol-date-error').hidden = !dateInvalid();
    host.querySelector('#ol-clear').hidden = !filtersActive();
  }
  function paintResults() {
    var b = dateBounds(), base = list.all.filter(function (r) { return matchesBase(r, b); });
    var rows = list.status === 'all' ? base : base.filter(function (r) { return r.status === list.status; });
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    list.page = Math.max(0, Math.min(list.page, pages - 1));
    paintChips(base);
    host.querySelector('#ol-results').innerHTML = rows.length ? rows.slice(list.page * PAGE_SIZE, (list.page + 1) * PAGE_SIZE).map(recordHtml).join('')
      : (list.all.length ? emptyBlock('⌕', t('adminOrd.noResult.title'), t('adminOrd.noResult.desc')) : emptyBlock('▣', t('adminOrd.empty.title'), t('adminOrd.empty.desc')));
    host.querySelector('#ol-count').textContent = t('adminOrd.count', { n: rows.length });
    host.querySelector('#ol-page-label').textContent = t('adminOrd.page', { p: list.page + 1, n: pages });
    host.querySelector('#ol-prev').disabled = list.page <= 0;
    host.querySelector('#ol-next').disabled = list.page >= pages - 1;
    host.querySelector('#ol-pager').style.display = rows.length <= PAGE_SIZE ? 'none' : '';
  }
  function loadList(my, keep) {
    host.innerHTML = C.loading();
    TTV.api.listAdminOrders().then(function (res) {
      if (my !== token) return;
      var rows = res.orders || [];
      rows.forEach(function (r) { r._hay = fold([r.code.replace('#', ''), r.service_name, r.customer_name, r.vendor_name, r.pickup, r.dropoff].join(' ')); });
      list = {
        all: rows, services: res.services || [], page: 0,
        q: keep ? keep.q : '', status: keep ? keep.status : 'all', service: keep ? keep.service : 'all',
        range: keep ? keep.range : 'all', from: keep ? keep.from : '', to: keep ? keep.to : ''
      };
      host.innerHTML = listShell(); paintResults();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('common.error'), msg(e), { icon: '!', label: t('adminOrd.retry'), action: 'ol-retry' });
    });
  }
  function renderList(ctx) {
    var s = TTV.auth.getSession(), my = ++token;
    list = null; detail = null;
    TTV.screens.admin.shell(ctx.path, t('adminOrd.title'), '', s && s.role);
    host = document.querySelector('.admin-content');
    loadList(my);
  }

  /* ===================== Chi tiết ===================== */
  function floorText(floor, elevator) {
    if (!(floor > 0)) return esc(t('adminOrd.job.ground'));
    return esc(t('od.floor', { n: floor, lift: t(elevator ? 'od.lift.yes' : 'od.lift.no') }));
  }
  function vendorTypeText(v) { return t('adminOrd.vendor.size', { type: labelOr('adminOrd.vtype.' + v.type, v.type), n: v.team_size }); }

  function customerCard(d) {
    var c = d.customer;
    if (!c) return C.card('<p class="admin-muted">' + none() + '</p>', { title: t('adminOrd.sec.customer') });
    if (c.missing) return C.card('<p class="admin-muted">' + esc(t('adminOrd.account.missing')) + '</p>', { title: t('adminOrd.sec.customer') });
    var body = '<dl class="admin-kv">' + kv(t('adminOrd.f.name'), c.name ? esc(c.name) : esc(t('adminOrd.noName'))) +
      kv(t('adminOrd.f.phone'), c.phone ? esc(c.phone) : none()) + kv(t('adminOrd.f.email'), c.email ? esc(c.email) : none()) +
      kv(t('adminOrd.f.account'), C.badge(t('adminOrd.account.' + c.status), c.status === 'locked' ? 'danger' : 'success')) + '</dl>' +
      '<div class="admin-actions admin-actions--card"><button type="button" class="btn btn-secondary btn-block" data-od-go="/admin/customers/' + esc(encodeURIComponent(c.id)) + '">' + esc(t('adminOrd.btn.viewCustomer')) + '</button></div>';
    return C.card(body, { title: t('adminOrd.sec.customer') });
  }
  function vendorCard(d) {
    var v = d.vendor;
    if (!v) return C.card('<p class="admin-card-desc">' + esc(t('adminOrd.vendor.noneDesc')) + '</p>', { title: t('adminOrd.sec.vendor') });
    if (v.missing) return C.card('<p class="admin-muted">' + esc(t('adminOrd.account.missing')) + '</p>', { title: t('adminOrd.sec.vendor') });
    var body = '<dl class="admin-kv">' + kv(t('adminOrd.f.name'), esc(v.name || t('adminOrd.noName'))) + kv(t('adminOrd.f.type'), esc(vendorTypeText(v))) +
      kv(t('adminOrd.f.phone'), v.phone ? esc(v.phone) : none()) +
      kv(t('adminOrd.f.rating'), v.rating > 0 ? esc('★ ' + v.rating.toFixed(1)) : esc(t('adminOrd.rating.none'))) +
      kv(t('adminOrd.f.jobsDone'), esc(String(v.jobs_done))) +
      kv(t('adminOrd.f.account'), C.badge(t('adminOrd.account.' + v.status), v.status === 'locked' ? 'danger' : 'success')) + '</dl>' +
      '<div class="admin-actions admin-actions--card"><button type="button" class="btn btn-secondary btn-block" data-od-go="/admin/vendors/' + esc(encodeURIComponent(v.id)) + '">' + esc(t('adminOrd.btn.viewVendor')) + '</button></div>';
    return C.card(body, { title: t('adminOrd.sec.vendor') });
  }
  function routeCard(o) {
    var body = '<dl class="admin-kv">' + kv(t('adminOrd.route.pick'), esc(o.pickup.addr || '—')) + kv(t('adminOrd.route.drop'), esc(o.dropoff.addr || '—')) +
      kv(t('adminOrd.route.km'), esc(km(o.distance_km))) + '</dl>';
    return C.card(body, { title: t('adminOrd.sec.route') });
  }
  function jobCard(o) {
    var rows = kv(t('adminOrd.job.service'), esc(o.service_name || '—')) + kv(t('adminOrd.job.weight'), o.weight_name ? esc(o.weight_name) : none()) +
      kv(t('adminOrd.job.pickupFloor'), floorText(o.pickup_floor, o.pickup_elevator)) +
      kv(t('adminOrd.job.needUnload'), esc(t(o.need_unload ? 'od.yes' : 'od.no')));
    if (o.need_unload) rows += kv(t('adminOrd.job.dropFloor'), floorText(o.drop_floor, o.drop_elevator));
    rows += kv(t('adminOrd.job.workers'), esc(t('od.workersN', { n: o.workers }))) +
      kv(t('adminOrd.job.speed'), esc(labelOr('adminOrd.speed.' + o.speed, o.speed))) +
      kv(t('adminOrd.job.provider'), esc(labelOr('adminOrd.provider.' + o.provider_type, o.provider_type))) +
      kv(t('adminOrd.job.schedule'), esc(labelOr('adminOrd.schedule.' + o.schedule_type, o.schedule_type)));
    if (o.quote_deadline) rows += kv(t('adminOrd.job.deadline'), esc(when(o.quote_deadline)));
    rows += kv(t('adminOrd.job.note'), o.note ? esc(o.note) : none());
    return C.card('<dl class="admin-kv">' + rows + '</dl>', { title: t('adminOrd.sec.job') });
  }
  function payCard(o) {
    var final = o.final_price != null ? esc(money(o.final_price)) : (o.status === 'finding' ? esc(t('adminOrd.pay.finalNone')) : none());
    var rows = kv(t('adminOrd.pay.method'), esc(labelOr('adminOrd.pay.' + o.pay_method, o.pay_method || '—'))) + kv(t('adminOrd.pay.max'), esc(money(o.user_offer)));
    if (o.speed === 'urgent' && o.current_offer !== o.user_offer) rows += kv(t('adminOrd.pay.current'), esc(money(o.current_offer)));
    rows += kv(t('adminOrd.pay.final'), '<b>' + final + '</b>');
    if (o.coupon_id) rows += kv(t('adminOrd.pay.coupon'), '<span class="admin-code">' + esc(o.coupon_id) + '</span>');
    if (o.commission_amount != null) {
      rows += kv(t('adminOrd.pay.commission', { rate: o.commission_rate != null ? o.commission_rate : '—' }), esc(money(o.commission_amount)));
      if (o.vendor_earning != null) rows += kv(t('adminOrd.pay.earning'), esc(money(o.vendor_earning)));
    }
    if (o.cash_collected != null && o.pay_method === 'cash') rows += kv(t('adminOrd.pay.cashCollected'), esc(t(o.cash_collected ? 'od.yes' : 'od.no')));
    var pb = o.price_breakdown, ref = kv(t('adminOrd.pay.base'), esc(money(pb.base))) + kv(t('adminOrd.pay.weight'), esc(money(pb.weight))) +
      kv(t('adminOrd.pay.floor'), esc(money(pb.floor))) + kv(t('adminOrd.pay.km'), esc(money(pb.distance)));
    if (pb.workers) ref += kv(t('adminOrd.pay.workers'), esc(money(pb.workers)));
    if (pb.discount) ref += kv(t('adminOrd.pay.discount'), '−' + esc(money(pb.discount)));
    var refTotal = o.total != null ? o.total : pb.base + pb.weight + pb.floor + pb.distance + pb.workers - pb.discount;
    ref += kv(t('adminOrd.pay.refTotal'), '<b>' + esc(money(refTotal)) + '</b>');
    return C.card('<dl class="admin-kv">' + rows + '</dl>', { title: t('adminOrd.sec.pay') }) +
      C.card('<p class="admin-card-desc">' + esc(t('adminOrd.pay.refHint')) + '</p><dl class="admin-kv">' + ref + '</dl>', { title: t('adminOrd.pay.refTitle') });
  }
  function mediaItem(m) {
    var p = esc(m.path);
    if (m.kind === 'video') {
      var dur = m.duration > 0 ? '<span class="admin-media-dur">' + esc(Math.floor(m.duration / 60) + ':' + String(Math.round(m.duration % 60)).padStart(2, '0')) + '</span>' : '';
      return '<div class="admin-media-video"><video controls preload="metadata" src="' + p + '"></video>' + dur + '</div>';
    }
    return '<a class="admin-media-img" href="' + p + '" target="_blank" rel="noopener" aria-label="' + esc(t('adminOrd.media.openImage')) + '"><img src="' + p + '" alt="" loading="lazy"></a>';
  }
  function mediaCard(d) {
    var orderM = d.media.filter(function (m) { return m.role !== 'proof'; }), proofM = d.media.filter(function (m) { return m.role === 'proof'; });
    if (!d.media.length) return C.card('<p class="admin-muted">' + esc(t('adminOrd.media.empty')) + '</p>', { title: t('adminOrd.sec.media') });
    var body = '';
    if (orderM.length) body += '<h4 class="admin-media-sub">' + esc(t('adminOrd.media.order')) + '</h4><div class="admin-media-grid">' + orderM.map(mediaItem).join('') + '</div>';
    if (proofM.length) body += '<h4 class="admin-media-sub">' + esc(t('adminOrd.media.proof')) + '</h4><div class="admin-media-grid">' + proofM.map(mediaItem).join('') + '</div>';
    return C.card(body, { title: t('adminOrd.sec.media') });
  }
  function tabInfo(d) {
    return customerCard(d) + vendorCard(d) + routeCard(d.order) + jobCard(d.order) + payCard(d.order) + mediaCard(d);
  }

  function tabQuotes(d) {
    var o = d.order, qs = d.quotes;
    if (!qs.length) return emptyBlock('₫', t('adminOrd.q.empty'), t('adminOrd.q.emptyDesc'));
    var min = qs.reduce(function (m, q) { return Math.min(m, q.price); }, Infinity);
    var head = '<p class="admin-page-intro">' + esc(t('adminOrd.q.summary', { n: qs.length, min: money(min), max: money(o.user_offer) })) + '</p>';
    return head + '<div class="admin-record-list">' + qs.map(function (q) {
      var v = q.vendor, rating = v.rating > 0 ? '★ ' + v.rating.toFixed(1) : t('adminOrd.rating.none');
      var badges = C.badge(labelOr('adminOrd.q.st.' + q.status, q.status), QUOTE_BADGE[q.status] || 'neutral') +
        C.badge(labelOr('adminOrd.vtype.' + v.type, v.type) + (v.team_size > 1 ? ' · ' + t('adminOrd.workers', { n: v.team_size }) : ''), 'info') + C.badge(rating, 'neutral');
      var times = [t('adminOrd.q.sent', { time: when(q.created_at) })];
      if (q.updated_at && q.updated_at !== q.created_at) times.push(t('adminOrd.q.updated', { time: when(q.updated_at) }));
      if (q.withdrawn_at) times.push(t('adminOrd.q.withdrawn', { time: when(q.withdrawn_at) }));
      var lower = q.price < o.user_offer ? '<p class="admin-muted">' + esc(t('adminOrd.q.lower', { x: money(o.user_offer - q.price) })) + '</p>' : '';
      var link = v.missing ? '' : ' admin-record--link" role="link" tabindex="0" data-od-go="/admin/vendors/' + esc(encodeURIComponent(q.vendor_id));
      return '<article class="admin-record' + (q.status === 'accepted' ? ' is-accepted' : '') + link + '">' +
        '<div class="admin-record__main"><strong>' + esc(v.missing ? t('adminOrd.q.vendorMissing') : (v.name || t('adminOrd.noName'))) + '</strong>' +
        '<div class="admin-record__badges">' + badges + '</div>' +
        '<p class="admin-muted">' + esc(t('adminOrd.q.eta', { n: q.eta_min })) + '</p>' +
        (q.message ? '<p>' + esc(q.message) + '</p>' : '') + lower +
        '<p class="admin-muted">' + esc(times.join(' · ')) + '</p></div>' +
        '<b class="admin-quote-price">' + esc(money(q.price)) + '</b></article>';
    }).join('') + '</div>';
  }

  function stepTime(d, ev) {
    var o = d.order, hit = null;
    d.timeline.forEach(function (x) { if (x.event === ev && !hit) hit = x; });
    if (hit && hit.at) return hit.at;
    if (ev === 'created') return o.created_at;
    if (ev === 'matched') return o.matched_at;
    if (ev === 'completed') return o.completed_at;
    return '';
  }
  function stepReached(d, ev, idx) {
    var o = d.order, inTl = d.timeline.some(function (x) { return x.event === ev; });
    if (ev === 'created' || inTl) return true;
    if (o.status === 'cancelled') return false;
    return STEPS.indexOf(o.status) >= idx;
  }
  function progressHtml(d) {
    var o = d.order, cancelled = o.status === 'cancelled', html = '';
    STEPS.forEach(function (ev, i) {
      var done = stepReached(d, ev, i);
      if (cancelled && !done) return;
      var at = done ? stepTime(d, ev) : '';
      html += '<li class="admin-step' + (done ? ' is-done' : '') + '"><span class="admin-step__dot">' + (done ? '✓' : '') + '</span><div class="admin-step__body"><strong>' + esc(t('od.step.' + ev)) + '</strong>' +
        '<span>' + esc(done ? (at ? when(at) : '—') : t('adminOrd.tl.waiting')) + '</span></div></li>';
    });
    if (cancelled) {
      html += '<li class="admin-step is-cancel"><span class="admin-step__dot">×</span><div class="admin-step__body"><strong>' + esc(t('adminOrd.tl.cancelled')) + '</strong>' +
        '<span>' + esc(when(o.cancelled_at || '')) + '</span>' + (o.cancel_reason ? '<span>' + esc(t('adminOrd.cancelledReason', { reason: o.cancel_reason })) + '</span>' : '') + '</div></li>';
    }
    return '<ol class="admin-steps">' + html + '</ol>';
  }
  function actorLabel(e) {
    var type = e.actor_type === 'admin' ? 'staff' : e.actor_type;
    if (['customer', 'vendor', 'staff', 'system'].indexOf(type) < 0) type = 'system';
    var role = t('adminOrd.actor.' + type);
    return e.actor_name ? t('adminOrd.actor.named', { role: role, name: e.actor_name }) : role;
  }
  function eventsHtml(d) {
    if (!d.events.length) return '<p class="admin-muted">' + esc(t('adminOrd.tl.eventsEmpty')) + '</p>';
    return '<ol class="admin-steps admin-steps--events">' + d.events.map(function (e) {
      var title = labelOr('adminOrd.ev.' + e.event, e.event || '—');
      return '<li class="admin-step is-done' + (e.event === 'cancelled' ? ' is-cancel' : '') + '"><span class="admin-step__dot"></span><div class="admin-step__body"><strong>' + esc(title) + '</strong>' +
        (e.note && e.note !== title ? '<span>' + esc(e.note) + '</span>' : '') +
        '<span>' + esc(actorLabel(e)) + ' · ' + esc(when(e.created_at, true)) + '</span></div></li>';
    }).join('') + '</ol>';
  }
  function tabTimeline(d) {
    return C.card(progressHtml(d), { title: t('adminOrd.tl.progress') }) + C.card(eventsHtml(d), { title: t('adminOrd.tl.events') });
  }

  function tabBody() {
    var d = detail.data;
    return detail.tab === 'quotes' ? tabQuotes(d) : detail.tab === 'timeline' ? tabTimeline(d) : tabInfo(d);
  }
  function tabChips() {
    return TABS.map(function (k) {
      var label = k === 'quotes' ? t('adminOrd.tab.quotes', { n: detail.data.quotes.length }) : t('adminOrd.tab.' + k);
      return chip('data-od-tab', k, label, detail.tab === k);
    }).join('');
  }
  function detailHtml() {
    var d = detail.data, o = d.order;
    var head = '<section class="admin-detail-head"><h2>' + esc(o.service_name || t('adminOrd.none')) + '</h2>' +
      '<button type="button" class="admin-code-btn" data-od="copy" aria-label="' + esc(t('adminOrd.copy')) + '">' + esc(o.code) + ' <span aria-hidden="true">⧉</span></button>' +
      '<span class="admin-muted">' + esc(t('adminOrd.createdAt', { time: TTV.Utils.relativeTime(o.created_at) || when(o.created_at) })) + ' · ' + esc(when(o.created_at)) + '</span>' +
      '<div class="admin-detail-badges">' + statusBadge(o.status) + (o.overdue ? C.badge(t('adminOrd.overdue'), 'danger') : '') + (o.demo ? C.badge(t('adminOrd.demo'), 'neutral') : '') + '</div>' +
      '<button type="button" class="admin-text-button" data-od="refresh">' + esc(t('adminOrd.refresh')) + '</button></section>';
    var note = '';
    if (o.status === 'cancelled') {
      var parts = [];
      if (o.cancelled_at) parts.push(t('adminOrd.cancelledAt', { time: when(o.cancelled_at) }));
      if (o.cancel_reason) parts.push(t('adminOrd.cancelledReason', { reason: o.cancel_reason }));
      note = C.notice(parts.join(' · ') || t('adminOrd.cancelledTitle'), t('adminOrd.cancelledTitle'));
    } else if (o.overdue) note = C.notice(t('adminOrd.overdueNote'), t('adminOrd.overdueTitle'));
    return '<div class="admin-detail">' + head + note + '<div class="admin-chip-row" id="od-tabs" role="group">' + tabChips() + '</div><div id="od-body">' + tabBody() + '</div></div>';
  }
  function paintDetail() { host.innerHTML = detailHtml(); }
  function paintBody() { // đổi tab: không vẽ lại đầu trang
    var body = host.querySelector('#od-body'); if (!body) return paintDetail();
    body.innerHTML = tabBody(); setSelected(host, 'data-od-tab', detail.tab);
  }
  function loadDetail(my, id, keepTab) {
    host.innerHTML = C.loading();
    return TTV.api.getAdminOrder(id).then(function (d) {
      if (my !== token) return;
      if (!d) { host.innerHTML = C.emptyState(t('adminOrd.detail.notFound'), t('adminOrd.detail.notFoundDesc'), { icon: '?', label: t('adminOrd.detail.back'), action: 'od-back' }); return; }
      detail = { id: d.order.id, data: d, tab: keepTab || 'info' };
      paintDetail();
    }).catch(function (e) {
      if (my !== token) return;
      host.innerHTML = C.emptyState(t('adminOrd.detail.loadError'), msg(e), { icon: '!', label: t('adminOrd.retry'), action: 'od-retry' });
    });
  }
  function renderDetail(ctx) {
    var s = TTV.auth.getSession(), my = ++token, id = ctx.params.id;
    list = null; detail = null;
    TTV.screens.admin.shell(ctx.path, t('adminOrd.detail.title'), '', s && s.role, { back: LIST, hideNav: true });
    host = document.querySelector('.admin-content');
    host.setAttribute('data-order-id', id);
    loadDetail(my, id);
  }
  function copyCode() {
    if (!detail) return;
    var code = detail.data.order.code;
    function ok() { C.toast(t('adminOrd.copy'), 'success'); }
    function bad() { C.toast(t('adminOrd.copyFail'), 'error'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, bad); else bad();
  }

  /* ===================== Sự kiện ===================== */
  function onClick(e) {
    var el, target = e.target;
    if (!target || !target.closest || !host || !document.body.contains(host)) return;
    if (detail && host.contains(target)) {
      if ((el = target.closest('[data-od-tab]'))) { detail.tab = el.getAttribute('data-od-tab'); paintBody(); return; }
      if ((el = target.closest('[data-od-go]'))) { goTo(el.getAttribute('data-od-go')); return; }
      if ((el = target.closest('[data-od]'))) {
        var k = el.getAttribute('data-od');
        if (k === 'copy') copyCode(); else if (k === 'refresh') loadDetail(token, detail.id, detail.tab);
        return;
      }
    }
    if (list && host.contains(target)) {
      if ((el = target.closest('[data-ol-open]'))) { goTo(LIST + '/' + encodeURIComponent(el.getAttribute('data-ol-open'))); return; }
      if ((el = target.closest('[data-ol-status]'))) { list.status = el.getAttribute('data-ol-status'); list.page = 0; paintResults(); return; }
      if ((el = target.closest('[data-ol-service]'))) { list.service = el.getAttribute('data-ol-service'); list.page = 0; paintResults(); return; }
      if ((el = target.closest('[data-ol-range]'))) { list.range = el.getAttribute('data-ol-range'); list.page = 0; paintResults(); return; }
      if (target.closest('[data-ol-clear]')) {
        list.q = ''; list.status = 'all'; list.service = 'all'; list.range = 'all'; list.from = ''; list.to = ''; list.page = 0;
        var s = host.querySelector('#ol-search'); if (s) s.value = '';
        var f = host.querySelector('#ol-from'), tt = host.querySelector('#ol-to'); if (f) f.value = ''; if (tt) tt.value = '';
        paintResults(); return;
      }
      if (target.closest('[data-ol-refresh]')) {
        loadList(token, { q: list.q, status: list.status, service: list.service, range: list.range, from: list.from, to: list.to }); return;
      }
      if ((el = target.closest('[data-ol-page]'))) { list.page += Number(el.getAttribute('data-ol-page')); paintResults(); window.scrollTo(0, 0); return; }
    }
    if ((el = target.closest('[data-action]')) && host.contains(el)) {
      var act = el.getAttribute('data-action');
      if (act === 'ol-retry') loadList(token);
      else if (act === 'od-retry') loadDetail(token, host.getAttribute('data-order-id'));
      else if (act === 'od-back') goTo(LIST);
    }
  }
  function onInput(e) {
    var el = e.target;
    if (!list || !el || !host || !host.contains(el)) return;
    if (el.id === 'ol-search') { list.q = el.value; list.page = 0; paintResults(); }
    else if (el.id === 'ol-from') { list.from = el.value; list.page = 0; paintResults(); }
    else if (el.id === 'ol-to') { list.to = el.value; list.page = 0; paintResults(); }
  }
  function onKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target && e.target.closest && e.target.closest('[data-ol-open], [data-od-go]');
    if (!el || e.target !== el || !host || !host.contains(el)) return;
    e.preventDefault();
    if (el.hasAttribute('data-ol-open')) goTo(LIST + '/' + encodeURIComponent(el.getAttribute('data-ol-open')));
    else goTo(el.getAttribute('data-od-go'));
  }
  function onMediaError(e) { // ảnh không tải được: thay bằng ô chữ, không để icon vỡ
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.closest || !img.closest('.admin-media-img')) return;
    var box = img.closest('.admin-media-img');
    box.classList.add('is-broken'); box.removeAttribute('href'); box.removeAttribute('target');
    box.innerHTML = '<span class="admin-media-err">' + esc(t('od.media.error') === 'od.media.error' ? 'Không tải được' : t('od.media.error')) + '</span>';
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('error', onMediaError, true);

  function destroy() { token++; list = null; detail = null; host = null; }

  TTV.screens.adminOrders = { renderList: renderList, renderDetail: renderDetail, destroy: destroy };
  var opts = { roles: ['SUPER_ADMIN'], loginRoute: '/staff-login', deniedRoute: '/admin', destroy: destroy };
  TTV.Router.add('/admin/orders', renderList, opts);
  TTV.Router.add('/admin/orders/:id', renderDetail, opts);
})(window.TTV);
