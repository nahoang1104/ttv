/* Điểm vào UI. Màn demo component dùng để kiểm tra task 1.3. */
window.TTV = window.TTV || {};
TTV.config = window.TTV_CONFIG;

// Chuẩn bị DB và nạp seed một lần trước khi điều hướng.
TTV.ready = TTV.Store.ready().then(function () { return TTV.Seed.run(); }).then(function (result) { return TTV.api.ensureSeedStaff().catch(function (e) { console.warn("[TTV] ensureSeedStaff:", e); }).then(function () { return result; }); }).then(function (result) {
  TTV.seedResult = result;
  return result;
}).catch(function (error) {
  console.error('[TTV] Không thể khởi tạo dữ liệu:', error);
  TTV.Components && TTV.Components.toast('Không khởi tạo được dữ liệu: ' + error.message, 'danger');
  throw error;
});
(function (TTV) {
  function renderDemo(ctx) {
    var C = TTV.Components, app = document.getElementById('app');
    app.classList.remove('is-wide');
    app.innerHTML = C.header('Thư viện component', { back: false }) + '<main class="page component-demo">' +
      '<p class="muted">Trang kiểm tra các thành phần dùng chung của TingTingVac.</p>' +
      C.card('<div class="component-row">' + C.button('Nút chính',{action:'demo-toast'}) + C.button('Nút phụ',{variant:'secondary',action:'demo-modal'}) + C.button('Vô hiệu hóa',{disabled:true}) + '</div>','').replace('<section class="card ">','<section class="card component-group">') +
      C.card('<div class="component-row">' + C.badge('Đang tìm thợ','warning') + C.badge('Hoàn thành','success') + C.badge('Đã hủy','neutral') + C.badge('Lỗi','danger') + C.badge('Thông tin','info') + '</div>','Nhãn trạng thái') +
      C.card('<div class="component-row">' + C.chip('Nhẹ',false,{action:'demo-chip'}) + C.chip('Vừa',true,{action:'demo-chip'}) + C.chip('Nặng',false,{action:'demo-chip'}) + '</div>','Chip chọn') +
      C.card(C.input('Họ và tên',{placeholder:'Nhập họ tên',name:'demo-name'}) + C.input('Số điện thoại',{placeholder:'09xx xxx xxx',type:'tel',name:'demo-phone'}),'Ô nhập liệu') +
      C.card(C.toggle('Có thang máy',true,{name:'demo-elevator'}) + C.stepper('Số lượng thợ',2,{min:1,max:10}),'Công tắc và bộ tăng/giảm') +
      C.card(C.tabs([{id:'all',label:'Tất cả'},{id:'finding',label:'Đang tìm thợ'},{id:'done',label:'Hoàn thành'},{id:'cancelled',label:'Đã hủy'}],'all'),'Tab ngang cuộn được') +
      C.card(C.search('Tìm đơn hàng…') ,'Thanh tìm kiếm') +
      C.card(C.notice('Mã giảm giá chỉ áp dụng cho đơn từ 2 thợ trở lên.','Lưu ý') ,'Khung cảnh báo') +
      C.card('<div class="component-row">' + C.avatar('Nguyễn Văn A') + C.avatar('Khách hàng', '', {size:'lg'}) + C.avatar('TTV','https://example.invalid/avatar.jpg',{size:'sm'}) + '</div>','Avatar') +
      C.card(C.emptyState('Chưa có đơn hàng','Các đơn hàng của bạn sẽ xuất hiện tại đây.',{label:'Tạo đơn',action:'demo-toast'}) ,'Trạng thái rỗng') +
      C.card(C.loading('Đang tải dữ liệu mẫu…'),'Trạng thái tải') +
      '<div class="component-group">' + C.button('Thử bottom sheet',{block:true,action:'demo-sheet'}) + '</div></main>' + C.bottomTab('home');
  }
  TTV.Router.add('/sim/components', renderDemo);
  TTV.Router.add('/sim/upload', function () {
    var C = TTV.Components, app = document.getElementById('app');
    app.classList.remove('is-wide');
    app.innerHTML = C.header('Kiểm tra upload', { back: true }) + '<main class="page component-demo">' +
      C.notice('Chọn thư mục gốc của project hoặc chính thư mục uploads. Ảnh được lưu nguyên bản, không nén. Để hiển thị qua đường dẫn uploads/…, thư mục phải nằm trong thư mục được phục vụ bởi web server.', 'Lưu ý') +
      '<section class="card"><h3 class="card__title">1. Thư mục lưu file</h3><button class="btn btn-secondary btn-block" data-action="upload-pick">Chọn thư mục uploads</button><p id="upload-dir-status" class="muted">Chưa kiểm tra thư mục.</p></section>' +
      '<section class="card"><h3 class="card__title">2. Tải ảnh thử</h3><label class="field"><span class="field__label">Chọn ảnh</span><input id="upload-image-file" type="file" accept="image/*"></label><button class="btn btn-primary btn-block" data-action="upload-image">Lưu ảnh nguyên bản</button><p id="upload-result" class="muted"></p><div id="upload-preview"></div></section>' +
      '<section class="card"><h3 class="card__title">3. Tải video thử</h3><label class="field"><span class="field__label">Chọn video (tối đa 2 phút)</span><input id="upload-video-file" type="file" accept="video/*"></label><button class="btn btn-secondary btn-block" data-action="upload-video">Lưu video nguyên bản</button><p id="upload-video-result" class="muted"></p><div id="upload-video-preview"></div></section>' +
      '<section class="card"><h3 class="card__title">Tiện ích 1.8</h3><p>Tiền: ' + TTV.Utils.money(30500) + '</p><p>Ngày: ' + TTV.Utils.date(new Date()) + '</p><p>SĐT: ' + TTV.Utils.maskPhone('0912345678') + '</p><p>Mã đơn: ' + TTV.Utils.orderCode('ab12cd34ef56') + '</p><p>Thời gian: ' + TTV.Utils.relativeTime(Date.now() - 8 * 3600000) + '</p><button class="btn btn-secondary btn-block" data-action="upload-audit">Ghi audit log thử</button></section>' +
      '</main>';
    TTV.Upload.hasDirectory().then(function (has) { var el = document.getElementById('upload-dir-status'); if (el) el.textContent = has ? 'Đã lưu handle thư mục. Có thể cần cấp lại quyền khi tải file.' : 'Chưa chọn thư mục.'; }).catch(function () {});
  });
  TTV.Router.add('/', function () {
    var app = document.getElementById('app');
    app.innerHTML = TTV.Components.header('TingTingVac',{back:false,large:true}) + '<main class="page">' + TTV.Components.card('<p>Khung ứng dụng đã sẵn sàng.</p><p class="muted">Nền tảng, lưu trữ, upload và tiện ích dùng chung đã có thể kiểm tra.</p><button class="btn btn-primary btn-block" data-route="/sim/components">Mở trang thử component</button><button class="btn btn-secondary btn-block" data-route="/sim/upload">Kiểm tra upload & tiện ích</button><button class=\"btn btn-primary btn-block\" data-route=\"/login\">Đăng nhập khách (task 2.2)</button>','Bắt đầu') + TTV.Components.notice('Đây là bản demo frontend; các màn nghiệp vụ sẽ được triển khai ở những task tiếp theo.') + '</main>';
  });
  TTV.Router.on404(function (ctx) { TTV.Router.render404(ctx); });
  document.addEventListener('click', function (e) {
    var action = e.target.closest('[data-action]'); if (!action) return;
    var key = action.getAttribute('data-action');
    if (key === 'demo-toast') TTV.Components.toast('Component hoạt động bình thường.','success');
    if (key === 'upload-pick') TTV.Upload.chooseDirectory().then(function (info) { var el = document.getElementById('upload-dir-status'); if (el) el.textContent = 'Đã chọn: ' + info.name + ' → uploads/'; TTV.Components.toast('Đã lưu thư mục upload.','success'); }).catch(function (err) { TTV.Components.toast(err.message || 'Không chọn được thư mục.','danger'); });
    if (key === 'upload-image') { var input = document.getElementById('upload-image-file'), file = input && input.files[0], result = document.getElementById('upload-result'); if (!file) { TTV.Components.toast('Hãy chọn một ảnh trước.','danger'); return; } result.textContent = 'Đang lưu ảnh nguyên bản…'; TTV.Upload.upload(file, { ownerId: 'demo', kind: 'order-images' }).then(function (saved) { result.textContent = 'Đã lưu: ' + saved.path + ' (' + Math.round(saved.size / 1024) + ' KB)'; var preview = document.getElementById('upload-preview'); preview.innerHTML = '<img class="upload-preview-image" alt="Ảnh vừa tải lên" src="' + saved.path + '"><p class="muted" data-preview-error hidden></p>'; var image = preview.querySelector('img'); image.onerror = function () { var note = preview.querySelector('[data-preview-error]'); note.hidden = false; note.textContent = 'File đã lưu nhưng URL không truy cập được. Hãy chọn đúng thư mục uploads nằm bên trong thư mục gốc đang được web server phục vụ, sau đó tải lại trang.'; }; image.onload = function () { var note = preview.querySelector('[data-preview-error]'); if (note) note.hidden = true; };  }).catch(function (err) { result.textContent = err.message || 'Tải ảnh thất bại.'; }); }
    if (key === 'upload-video') { var vi = document.getElementById('upload-video-file'), vf = vi && vi.files[0], vr = document.getElementById('upload-video-result'); if (!vf) { TTV.Components.toast('Hãy chọn video trước.','danger'); return; } vr.textContent = 'Đang kiểm tra và lưu video nguyên bản…'; TTV.Upload.upload(vf, { ownerId: 'demo', kind: 'order-videos' }).then(function (saved) { var duration = Number(saved.duration) || 0, mmss = Math.floor(duration / 60) + ':' + String(Math.floor(duration % 60)).padStart(2, '0'); vr.textContent = 'Đã lưu video: ' + saved.path + ' (' + Math.round(saved.size / 1024) + ' KB) — thời lượng ' + mmss; var preview = document.getElementById('upload-video-preview'); preview.innerHTML = '<video class="upload-preview-image" controls preload="metadata" src="' + saved.path + '"></video><p class="muted" data-video-error hidden></p>'; var video = preview.querySelector('video'); video.onerror = function () { var note = preview.querySelector('[data-video-error]'); note.hidden = false; note.textContent = 'Video đã lưu vào ổ đĩa nhưng URL không truy cập được. Hãy đặt uploads/ bên trong thư mục gốc web server đang phục vụ.'; }; }).catch(function (err) { vr.textContent = err.message || 'Lưu video thất bại.'; }); }
    if (key === 'upload-audit') TTV.Utils.audit('demo.test', { target_table: 'audit_logs', detail: { source: 'sim/upload' } }).then(function () { TTV.Components.toast('Đã ghi audit log.','success'); }).catch(function (err) { TTV.Components.toast(err.message,'danger'); });
    if (key === 'demo-modal') document.body.insertAdjacentHTML('beforeend', TTV.Components.modal('Modal mẫu','<p>Đây là nội dung modal dùng chung.</p>',{footer:TTV.Components.button('Đã hiểu',{action:'demo-close',variant:'primary'})}));
    if (key === 'demo-close') { var m = document.querySelector('.modal-backdrop'); if (m) m.remove(); }
    if (key === 'demo-sheet') document.body.insertAdjacentHTML('beforeend', TTV.Components.sheet('Bottom sheet mẫu','<p>Thành phần dạng sheet trượt lên từ đáy màn hình.</p>',{footer:TTV.Components.button('Đóng',{action:'demo-close-sheet',variant:'primary'})}));
    if (key === 'demo-close-sheet') { var s = document.querySelector('.sheet-backdrop'); if (s) s.remove(); }
    if (key === 'demo-chip') { var group = action.parentElement; group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-selected'); c.setAttribute('aria-pressed','false'); }); action.classList.add('is-selected'); action.setAttribute('aria-pressed','true'); }
  });
  document.addEventListener('click', function(e){var tab=e.target.closest('[data-tab]');if(tab){tab.parentElement.querySelectorAll('[data-tab]').forEach(function(t){t.classList.toggle('is-active',t===tab);t.setAttribute('aria-selected',t===tab?'true':'false');});}});
  TTV.ready.then(function () { TTV.Router.start(); }).catch(function () {
    var app = document.getElementById('app');
    app.innerHTML = '<main class="page"><h2>Không thể khởi tạo ứng dụng</h2><p>Hãy tải lại trang. Nếu lỗi tiếp tục, kiểm tra quyền IndexedDB hoặc chế độ duyệt riêng tư.</p></main>';
  });
})(window.TTV);
