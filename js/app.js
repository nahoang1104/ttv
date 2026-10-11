/* Điểm vào UI: mở DB, seed, đăng ký route. */
window.TTV = window.TTV || {};
TTV.config = window.TTV_CONFIG;

TTV.ready = TTV.Store.ready().then(function () { return TTV.Seed.run(); }).then(function (result) {
  TTV.seedResult = result;
  return result;
}).catch(function (error) {
  console.error('[TTV] Không thể khởi tạo dữ liệu:', error);
  TTV.Components && TTV.Components.toast('Không khởi tạo được dữ liệu: ' + error.message, 'danger');
  throw error;
});

(function (TTV) {
  function stub(title, tab) {
    return function (ctx) {
      var C = TTV.Components, app = document.getElementById('app'), extra = '';
      app.classList.remove('is-wide');
      if (ctx.path === '/create/order') {
        extra += '<p>Dịch vụ: <strong>' + C.escape(ctx.query.service || 'chưa chọn') + '</strong></p>';
        var pasted = '';
        try { pasted = sessionStorage.getItem(TTV.screens.home.pasteKey) || ''; } catch (_) {}
        if (pasted) extra += '<p>Điểm trả đã dán: ' + C.escape(pasted) + '</p>';
      }
      app.innerHTML = C.header(title, { back: true }) + '<main class="page">' + extra +
        C.notice('Màn hình này sẽ được làm đầy đủ ở các task tiếp theo.', 'Sắp có') + '</main>' + C.bottomTab(tab || '');
    };
  }

  TTV.Router.add('/home', function () {
    TTV.screens.home.render(document.getElementById('app'));
  }, { destroy: function () { TTV.screens.home.destroy(); } });
  TTV.Router.add('/create/order', stub('Đặt đơn bốc vác', 'home'));
  TTV.Router.add('/notifications', stub('Thông báo', 'home'));
  TTV.Router.add('/coupons', stub('Mã giảm giá', 'home'));
  TTV.Router.add('/wallet', stub('Ví của tôi', 'wallet'));
  TTV.Router.add('/orders', stub('Đơn hàng', 'history'));
  TTV.Router.add('/profile', stub('Cá nhân', 'profile'));
  TTV.Router.add('/', function () { TTV.Router.navigate('/home'); });

  TTV.ready.then(function () { TTV.Router.start(); }).catch(function () {
    document.getElementById('app').innerHTML = '<main class="page"><h2>Không thể khởi tạo ứng dụng</h2><p>Hãy tải lại trang. Nếu lỗi tiếp tục, kiểm tra quyền IndexedDB hoặc chế độ duyệt riêng tư.</p></main>';
  });
})(window.TTV);
