/* Đơn mẫu để thử Chợ đơn (5.2) và Chi tiết đơn (5.3) khi chưa có đơn thật (task 4.9 chưa xong).
   Mở #/sim/demo-orders → "Tạo đơn mẫu" / "Xóa đơn mẫu". Mọi bản ghi mẫu có cờ `demo:true`; xóa chỉ đụng bản ghi có cờ này.
   Có thể gỡ file này (và thẻ <script> trong index.html) khi 5.9 làm panel #/sim chính thức. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var DEMO_USER = 'demo-customer-user';
  var IMGS = ['uploads/img-giaodien/item1.png', 'uploads/img-giaodien/item2.png', 'uploads/img-giaodien/chuyennha.png', 'uploads/img-giaodien/noithat.png'];
  function place(addr, lat, lng) { return { addr: addr, lat: lat, lng: lng }; }
  var A = {
    q1: place('12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM', 10.7742, 106.7035),
    q12: place('45 Hà Huy Giáp, Phường Thạnh Lộc, Quận 12, TP.HCM', 10.8667, 106.6782),
    bt: place('200 Điện Biên Phủ, Phường 7, Bình Thạnh, TP.HCM', 10.7993, 106.7071),
    td: place('88 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM', 10.8503, 106.7717),
    q8: place('30 Phạm Thế Hiển, Phường 4, Quận 8, TP.HCM', 10.7424, 106.6676),
    q10: place('5 Sư Vạn Hạnh, Phường 9, Quận 10, TP.HCM', 10.7721, 106.6697)
  };
  // [dịch vụ, bốc, trả, km, trọng lượng, tầng bốc, thang bốc, dỡ?, tầng dỡ, thang dỡ, thợ, tốc độ, nhà cung cấp, tiền khách trả tối đa, phút trước, ghi chú, status, số ảnh, có video]
  var SPECS = [
    ['moving', A.q1, A.bt, 3.2, 'medium', 3, true, true, 2, false, 1, 'default', 'any', 450000, 4, 'Có 1 tủ lạnh và 2 tủ quần áo lớn.', 'finding', 3, false],
    ['furniture', A.q12, A.td, 14.6, 'heavy', 5, false, true, 4, true, 1, 'urgent', 'any', 780000, 9, 'Cần đến gấp trước 5 giờ chiều.', 'finding', 4, true],
    ['goods', A.bt, A.q1, 3.8, 'light', 0, false, false, 0, false, 1, 'fast', 'personal', 120000, 12, '', 'finding', 0, false],
    ['moving', A.q10, A.q8, 4.9, 'very_heavy', 2, true, true, 3, false, 3, 'default', 'any', 1500000, 6, 'Chuyển nguyên căn hộ 2 phòng ngủ.', 'finding', 2, false],
    ['warehouse', A.td, A.q12, 12.1, 'heavy', 0, false, true, 0, false, 5, 'default', 'company', 2400000, 15, 'Bốc 120 thùng hàng lên xe tải.', 'finding', 1, false],
    ['office', A.q8, A.q10, 4.9, 'medium', 1, false, true, 1, true, 1, 'default', 'any', 300000, 20, 'Thiết bị văn phòng, có thang máy hàng.', 'finding', 0, false],
    ['hourly', A.q1, A.q1, 0, 'light', 0, false, false, 0, false, 1, 'default', 'any', 200000, 70, 'Đơn quá hạn nhận báo giá (để thử lọc).', 'finding', 0, false],
    ['moving', A.q1, A.bt, 3.2, 'medium', 3, true, true, 2, false, 1, 'default', 'any', 450000, 120, 'Đơn đã ghép thợ khác (không hiện ở chợ).', 'matched', 0, false]
  ];

  function makeOrder(s, i, now) {
    var id = TTV.Utils.id().replace(/-/g, '').slice(0, 12);
    var created = new Date(now - s[14] * 60000);
    var order = {
      id: id, demo: true, user_id: DEMO_USER, service: s[0], pickup: s[1], dropoff: s[2], distance_km: s[3], weight_tier: s[4],
      pickup_floor: s[5], pickup_elevator: s[6], need_unload: s[7], drop_floor: s[8], drop_elevator: s[9], workers: s[10],
      note: s[15], schedule_type: 'now', speed: s[11], provider_type: s[12], user_offer: s[13],
      price_breakdown: { base: s[0] === 'moving' ? 50000 : 100000, weight: 100000, floor: 39000, distance: Math.round(s[3] * 5000) },
      pay_method: i % 2 ? 'wallet' : 'cash', status: s[16], vendor_id: s[16] === 'matched' ? 'vendor-demo-company' : null,
      quote_deadline: new Date(created.getTime() + 30 * 60000).toISOString(), created_at: created.toISOString(), timeline: []
    };
    var media = [];
    for (var k = 0; k < s[17]; k++) media.push({ id: id + '-img' + k, demo: true, order_id: id, kind: 'image', path: IMGS[k % IMGS.length], duration: 0 });
    if (s[18]) media.push({ id: id + '-vid', demo: true, order_id: id, kind: 'video', path: 'uploads/demo-missing.mp4', duration: 4 });
    return { order: order, media: media };
  }
  function chain(items, fn) { return items.reduce(function (p, it) { return p.then(function () { return fn(it); }); }, Promise.resolve()); }

  TTV.DemoOrders = {
    create: function () {
      var now = Date.now(), made = SPECS.map(function (s, i) { return makeOrder(s, i, now); });
      return TTV.Store.get('users', DEMO_USER).then(function (u) {
        return u ? null : TTV.Store.put('users', { id: DEMO_USER, demo: true, phone: '+84900000099', name: 'Khách demo', email: 'khach.demo@example.com', login_method: 'demo', kyc_status: 'none', wallet_balance: 0, created_at: new Date(now).toISOString() });
      }).then(function () {
        return chain(made, function (m) { return TTV.Store.put('orders', m.order).then(function () { return chain(m.media, function (md) { return TTV.Store.put('order_media', md); }); }); });
      }).then(function () { return made.length; });
    },
    clear: function () {
      var n = 0;
      return Promise.all([TTV.Store.list('orders'), TTV.Store.list('order_media')]).then(function (p) {
        var rows = p[0].filter(function (o) { return o.demo; }).map(function (o) { return ['orders', o.id]; })
          .concat(p[1].filter(function (m) { return m.demo; }).map(function (m) { return ['order_media', m.id]; }));
        n = rows.length;
        return chain(rows, function (r) { return TTV.Store.remove(r[0], r[1]); });
      }).then(function () { return n; });
    }
  };

  TTV.Router.add('/sim/demo-orders', function () {
    var C = TTV.Components, app = document.getElementById('app');
    app.classList.remove('is-wide');
    app.innerHTML = C.header('Đơn mẫu (demo)', { back: true }) + '<main class="page component-demo">' +
      C.notice('Tạo 8 đơn mẫu để thử Chợ đơn / Chi tiết đơn của thợ khi chưa có đơn thật. Đơn có cờ demo, xóa bằng nút bên dưới. Đăng nhập thợ (thanhcong / anphat / thoboc… phải được admin đặt mật khẩu ở 3.4) rồi bật \"Sẵn sàng nhận đơn\".', 'Dành cho thử nghiệm') +
      '<section class="card"><button class="btn btn-primary btn-block" data-demo-orders="create">Tạo đơn mẫu</button>' +
      '<button class="btn btn-secondary btn-block" style="margin-top:10px" data-demo-orders="clear">Xóa đơn mẫu</button>' +
      '<p class="muted" id="demo-orders-status"></p></section></main>';
    app.onclick = function (e) {
      var b = e.target.closest('[data-demo-orders]'); if (!b) return;
      var st = document.getElementById('demo-orders-status'), act = b.getAttribute('data-demo-orders');
      b.disabled = true;
      (act === 'create' ? TTV.DemoOrders.create() : TTV.DemoOrders.clear()).then(function (n) {
        if (st) st.textContent = (act === 'create' ? 'Đã tạo ' : 'Đã xóa ') + n + ' bản ghi mẫu.';
      }).catch(function (err) { if (st) st.textContent = 'Lỗi: ' + err.message; }).then(function () { b.disabled = false; });
    };
  }, { destroy: function () { var a = document.getElementById('app'); if (a) a.onclick = null; } });
})(window.TTV);
