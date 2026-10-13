/* i18n.js — bản địa hóa và tiện ích dùng chung. Mặc định tiếng Việt; tiếng Anh để dành. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var dictionaries = {
    vi: {
      'common.loading': 'Đang tải…',
      'common.save': 'Lưu',
      'common.cancel': 'Hủy',
      'common.error': 'Đã xảy ra lỗi',
      'common.comingSoon': 'Sắp có',
      'quotes.title': 'Đang nhận báo giá',
      'quotes.pickup': 'Bốc',
      'quotes.dropoff': 'Trả',
      'quotes.offer': 'Số tiền bạn trả',
      'quotes.remain': 'Còn lại để nhận báo giá',
      'quotes.expired': 'Không tìm được thợ',
      'quotes.empty.title': 'Chưa có báo giá nào',
      'quotes.empty.desc': 'Đang chờ thợ/tổ đội phản hồi…',
      'quotes.cancel': 'Huỷ đơn',
      'quotes.cancel.title': 'Huỷ đơn?',
      'quotes.cancel.body': 'Đơn này sẽ bị huỷ và hoàn tiền. Bạn cần đặt lại nếu muốn tiếp tục.',
      'quotes.cancel.no': 'Không',
      'quotes.cancel.yes': 'Huỷ đơn',
      'quotes.cancel.done': 'Đã huỷ đơn.',
      'quotes.cancel.fail': 'Không huỷ được đơn.',
      'quotes.cancelled': 'Đơn này đã bị huỷ.',
      'quotes.err.title': 'Không tải được đơn',
      'orders.title': 'Đơn hàng',
      'orders.search': 'Tìm theo mã đơn hoặc địa chỉ…',
      'orders.tab.all': 'Tất cả',
      'orders.tab.finding': 'Đang tìm thợ',
      'orders.tab.doing': 'Đang thực hiện',
      'orders.tab.done': 'Hoàn thành',
      'orders.tab.cancelled': 'Đã hủy',
      'orders.status.finding': 'Đang tìm thợ',
      'orders.status.doing': 'Đang thực hiện',
      'orders.status.done': 'Hoàn thành',
      'orders.status.cancelled': 'Đã hủy',
      'orders.follow': 'Theo dõi',
      'orders.reorder': 'Đặt lại',
      'orders.empty.title': 'Chưa có đơn hàng',
      'orders.empty.desc': 'Các đơn bạn đặt sẽ hiện tại đây.',
      'orders.empty.filter': 'Không có đơn phù hợp',
      'orders.err': 'Không tải được danh sách đơn.',
      'orders.month': 'Tháng {m}/{y}',
      'home.greet.morning': 'Buổi sáng vui vẻ!',
      'home.greet.noon': 'Buổi trưa vui vẻ!',
      'home.greet.afternoon': 'Buổi chiều vui vẻ!',
      'home.greet.evening': 'Buổi tối vui vẻ!',
      'home.notifications': 'Thông báo',
      'home.pickup.label': 'Điểm bốc hàng…',
      'home.pickup.placeholder': 'Chọn điểm bốc hàng của bạn',
      'home.dropoff.label': 'Bốc vác đến?',
      'home.paste': 'Dán',
      'home.paste.denied': 'Không đọc được clipboard. Hãy dán thủ công trên form đặt đơn.',
      'home.services': 'Dịch vụ',
      'home.explore': 'Khám phá thêm',
      'home.banner.cta': 'Tham gia ngay',
      'home.banner.member': 'Ưu đãi Hội viên',
      'home.banner.memberSub': 'Tiết kiệm đến 20% mọi đơn bốc vác',
      'home.banner.promo': 'Ưu đãi khách mới',
      'home.explore.card1': 'Bốc vác công kênh chuyên nghiệp',
      'home.explore.card2': 'Khai giá hàng hóa là gì?',
      'profile.title': 'Cá nhân',
      'profile.loadError': 'Không tải được hồ sơ',
      'profile.noName': 'Khách hàng',
      'profile.edit': 'Sửa thông tin cá nhân',
      'profile.stats': 'Thống kê đơn hàng',
      'profile.stats.completed': 'Đơn hoàn thành',
      'profile.stats.processing': 'Đang xử lý',
      'profile.phone.demo': 'Tài khoản {method} (demo)',
      'profile.section.account': 'Tài khoản của tôi',
      'profile.section.support': 'Hỗ trợ & Cài đặt',
      'profile.menu.info': 'Thông tin cá nhân',
      'profile.menu.addresses': 'Sổ địa chỉ',
      'profile.menu.payment': 'Phương thức thanh toán',
      'profile.menu.coupons': 'Mã giảm giá của tôi',
      'profile.menu.reviews': 'Đánh giá của tôi',
      'profile.menu.notifications': 'Thông báo',
      'profile.menu.security': 'Bảo mật',
      'profile.menu.reports': 'Lịch sử báo cáo',
      'profile.menu.help': 'Trợ giúp & Hỗ trợ',
      'profile.menu.policies': 'Điều khoản & Chính sách',
      'profile.menu.settings': 'Cài đặt',
      'profile.soon.toast': 'Tính năng này sắp có.',
      'profile.version': 'Phiên bản {v}',
      'profile.logout': 'Đăng xuất',
      'profile.logout.confirm': 'Bạn có chắc muốn đăng xuất khỏi tài khoản?',
      'profile.logout.done': 'Đã đăng xuất.',
      'profile.info.title': 'Thông tin cá nhân',
      'profile.avatar.change': 'Đổi ảnh',
      'profile.field.name': 'Họ và tên',
      'profile.field.phone': 'Số điện thoại',
      'profile.field.email': 'Email',
      'profile.field.gender': 'Giới tính',
      'profile.field.dob': 'Ngày sinh',
      'profile.phone.locked': 'Không thể thay đổi',
      'profile.email.placeholder': 'Nhập email của bạn',
      'profile.gender.placeholder': 'Chọn giới tính',
      'profile.save': 'Lưu thay đổi',
      'profile.saving': 'Đang lưu…',
      'profile.saved': 'Đã lưu thay đổi.',
      'profile.error.name': 'Họ và tên cần ít nhất 2 ký tự.',
      'profile.error.email': 'Email không hợp lệ.',
      'profile.error.save': 'Không lưu được thay đổi.',
      'profile.error.avatarType': 'Vui lòng chọn một file ảnh.',
      'profile.error.avatarSize': 'Ảnh quá lớn (tối đa 10 MB).',
      'profile.error.avatarSave': 'Không lưu được ảnh đại diện. {reason}',
      'profile.error.pickerCancelled': 'Bạn đã hủy chọn thư mục lưu ảnh nên chưa lưu được ảnh đại diện.',
      'adminVendor.title': 'Tạo tài khoản thợ',
      'adminVendor.create': '＋ Tạo tài khoản thợ',
      'adminVendor.intro': 'Tạo tài khoản đăng nhập cho thợ, tổ đội hoặc công ty. Thợ sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.',
      'adminVendor.section.info': 'Thông tin thợ',
      'adminVendor.section.account': 'Tài khoản đăng nhập',
      'adminVendor.section.capacity': 'Năng lực hoạt động',
      'adminVendor.section.commission': 'Hoa hồng',
      'adminVendor.field.type': 'Loại nhà cung cấp',
      'adminVendor.type.personal': 'Cá nhân',
      'adminVendor.type.team': 'Tổ đội',
      'adminVendor.type.company': 'Công ty',
      'adminVendor.field.name.personal': 'Họ và tên thợ',
      'adminVendor.field.name.team': 'Tên tổ đội',
      'adminVendor.field.name.company': 'Tên công ty',
      'adminVendor.ph.name.personal': 'Ví dụ: Nguyễn Văn Bốc',
      'adminVendor.ph.name.team': 'Ví dụ: Tổ bốc xếp Thành Công',
      'adminVendor.ph.name.company': 'Ví dụ: Công ty Vận chuyển An Phát',
      'adminVendor.field.phone': 'Số điện thoại',
      'adminVendor.ph.phone': 'Ví dụ: 0901234567',
      'adminVendor.field.email': 'Email',
      'adminVendor.ph.email': 'ten@example.com',
      'adminVendor.field.username': 'Tên đăng nhập',
      'adminVendor.ph.username': 'Ví dụ: thanhcong',
      'adminVendor.hint.username': '4–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.',
      'adminVendor.field.password': 'Mật khẩu tạm',
      'adminVendor.hint.password': 'Ít nhất 8 ký tự, có chữ và số, không có khoảng trắng. Thợ phải đổi mật khẩu khi đăng nhập lần đầu.',
      'adminVendor.btn.generate': '↻ Sinh ngẫu nhiên',
      'adminVendor.btn.copy': '⧉ Sao chép',
      'adminVendor.copied': 'Đã sao chép.',
      'adminVendor.copyFailed': 'Không sao chép được. Hãy chọn và sao chép thủ công.',
      'adminVendor.field.teamSize': 'Số thợ',
      'adminVendor.hint.teamPersonal': 'Tài khoản cá nhân luôn là 1 thợ.',
      'adminVendor.hint.teamRange': 'Từ {min} đến {max} thợ. Thợ chỉ thấy đơn có số thợ không vượt quá quy mô này.',
      'adminVendor.field.services': 'Dịch vụ nhận đơn',
      'adminVendor.btn.selectAll': 'Chọn tất cả',
      'adminVendor.btn.clearAll': 'Bỏ chọn',
      'adminVendor.field.areas': 'Khu vực hoạt động',
      'adminVendor.hint.areas': 'Chọn “Toàn TP.HCM” hoặc từng quận/huyện.',
      'adminVendor.field.vehicle': 'Phương tiện',
      'adminVendor.ph.vehicle': 'Ví dụ: Xe tải 1.5 tấn',
      'adminVendor.hint.vehicle': 'Không bắt buộc.',
      'adminVendor.field.commission': 'Hoa hồng riêng (%)',
      'adminVendor.ph.commission': 'Mặc định {rate}%',
      'adminVendor.hint.commission': 'Để trống để dùng mức mặc định ({rate}%).',
      'adminVendor.submit': 'Tạo tài khoản',
      'adminVendor.submitting': 'Đang tạo…',
      'adminVendor.err.fix': 'Vui lòng kiểm tra lại các trường được đánh dấu.',
      'adminVendor.err.generic': 'Không tạo được tài khoản. Vui lòng thử lại.',
      'adminVendor.err.taken': 'Tên đăng nhập đã được sử dụng.',
      'adminCfg.title': 'Giá & cấu hình',
      'adminCfg.intro': 'Chỉnh đơn giá và thiết lập hệ thống. Thay đổi chỉ có hiệu lực sau khi bấm Lưu thay đổi.',
      'adminCfg.tab.price': 'Đơn giá',
      'adminCfg.tab.fees': 'Phí & tốc độ',
      'adminCfg.tab.system': 'Hệ thống',
      'adminCfg.sec.services': 'Giá cơ bản theo dịch vụ',
      'adminCfg.sec.services.desc': 'Giá khởi điểm của mỗi dịch vụ, cộng thêm phí trọng lượng, tầng và khoảng cách.',
      'adminCfg.sec.weight': 'Phí theo trọng lượng',
      'adminCfg.sec.weight.desc': 'Cộng vào giá mỗi đơn theo mức trọng lượng khách chọn.',
      'adminCfg.sec.floor': 'Phí tầng và khoảng cách',
      'adminCfg.sec.speed': 'Hệ số tốc độ nhận đơn',
      'adminCfg.sec.speed.desc': 'Nhân vào giá tự tính. Mức Mặc định luôn là ×1.',
      'adminCfg.sec.rules': 'Quy định đơn hàng',
      'adminCfg.sec.commission': 'Hoa hồng và ví thợ',
      'adminCfg.sec.bot': 'Chế độ demo',
      'adminCfg.sec.contact': 'Liên hệ hỗ trợ',
      'adminCfg.sec.topup': 'Nạp tiền',
      'adminCfg.f.floor_fee': 'Phí mỗi tầng (đ)',
      'adminCfg.h.floor_fee': 'Tính riêng nơi bốc và nơi dỡ: số tầng × phí này.',
      'adminCfg.f.elevator_pct': 'Giảm phí tầng khi có thang máy (%)',
      'adminCfg.h.elevator_pct': 'Ví dụ 70 nghĩa là chỉ tính 30% phí tầng.',
      'adminCfg.f.km_fee': 'Phí mỗi km (đ)',
      'adminCfg.f.speed_default': 'Mặc định (×)',
      'adminCfg.f.speed_fast': 'Nhanh (×)',
      'adminCfg.f.speed_urgent': 'Gấp (×)',
      'adminCfg.h.speed': 'Từ 1 đến 10, tối đa 2 chữ số thập phân; Gấp phải lớn hơn hoặc bằng Nhanh.',
      'adminCfg.f.min_amount': 'Số tiền khách trả tối thiểu (đ)',
      'adminCfg.h.min_amount': 'Từ 1.000đ đến 10.000.000đ.',
      'adminCfg.f.quote_window_min': 'Thời gian chờ báo giá (phút)',
      'adminCfg.h.quote_window_min': 'Đơn không ai nhận sau thời gian này sẽ tự hủy.',
      'adminCfg.f.commission_default': 'Hoa hồng mặc định (%)',
      'adminCfg.h.commission_default': 'Áp dụng cho thợ không có hoa hồng riêng.',
      'adminCfg.f.wallet_negative_limit': 'Ngưỡng ví thợ âm tối đa (đ)',
      'adminCfg.h.wallet_negative_limit': 'Nhập số dương. Ví thợ thấp hơn mức âm này thì tạm khóa nhận đơn.',
      'adminCfg.f.bot': 'Bật thợ báo giá tự động (demo)',
      'adminCfg.h.bot': 'Với đơn 1 thợ, hệ thống tự sinh vài báo giá mẫu sau ít giây.',
      'adminCfg.f.hotline': 'Hotline',
      'adminCfg.f.support_email': 'Email hỗ trợ',
      'adminCfg.f.zalo_url': 'Link Zalo',
      'adminCfg.h.zalo_url': 'Bắt buộc bắt đầu bằng https://',
      'adminCfg.f.topup_amounts': 'Các mức nạp nhanh (đ)',
      'adminCfg.h.topup_amounts': 'Từ 1 đến 9 mức, mỗi mức từ 10.000đ.',
      'adminCfg.ph.topup_add': 'Nhập số tiền',
      'adminCfg.btn.topup_add': 'Thêm',
      'adminCfg.topup.remove': 'Xóa mức {amount}',
      'adminCfg.f.topup_fee': 'Phí giao dịch nạp tiền (đ)',
      'adminCfg.btn.save': 'Lưu thay đổi',
      'adminCfg.btn.saving': 'Đang lưu…',
      'adminCfg.btn.reset': 'Hoàn tác',
      'adminCfg.toast.saved': 'Đã lưu cấu hình.',
      'adminCfg.toast.noChange': 'Không có thay đổi.',
      'adminCfg.toast.reverted': 'Đã hoàn tác thay đổi chưa lưu.',
      'adminCfg.err.fix': 'Vui lòng kiểm tra lại các trường được đánh dấu.',
      'adminCfg.err.generic': 'Không lưu được. Vui lòng thử lại.',
      'adminCfg.err.topup': 'Số tiền không hợp lệ (từ 10.000đ đến 50.000.000đ).',
      'adminCfg.err.topupDup': 'Mức này đã có.',
      'adminCfg.err.topupMax': 'Tối đa 9 mức nạp nhanh.',
      'adminCfg.retry': 'Thử lại',
      'adminCfg.loadError': 'Không tải được cấu hình.',
      'adminVendors.title': 'Thợ & tổ đội',
      'adminVendors.search': 'Tìm theo tên, tên đăng nhập, SĐT…',
      'adminVendors.filter.all': 'Tất cả',
      'adminVendors.filter.active': 'Hoạt động',
      'adminVendors.filter.locked': 'Đã khóa',
      'adminVendors.filter.anyType': 'Mọi loại',
      'adminVendors.count': '{n} thợ',
      'adminVendors.page': 'Trang {p} / {n}',
      'adminVendors.prev': '‹ Trước',
      'adminVendors.next': 'Tiếp ›',
      'adminVendors.empty.title': 'Chưa có tài khoản thợ nào',
      'adminVendors.empty.desc': 'Tạo tài khoản đầu tiên để thợ có thể đăng nhập.',
      'adminVendors.noResult.title': 'Không tìm thấy kết quả',
      'adminVendors.noResult.desc': 'Thử đổi từ khóa hoặc bộ lọc.',
      'adminVendors.status.active': 'Hoạt động',
      'adminVendors.status.locked': 'Đã khóa',
      'adminVendors.mustChange': 'Chờ đổi mật khẩu',
      'adminVendors.online': 'Sẵn sàng nhận đơn',
      'adminVendors.offline': 'Ngoại tuyến',
      'adminVendors.teamSize': '{n} thợ',
      'adminVendors.workers': '{n} thợ · ',
      'adminVendors.jobs': '{n} đơn',
      'adminVendors.noRating': 'Chưa có đánh giá',
      'adminVendors.none': '—',
      'adminVendors.detail.title': 'Chi tiết thợ',
      'adminVendors.detail.notFound': 'Không tìm thấy tài khoản thợ này',
      'adminVendors.detail.notFoundDesc': 'Tài khoản có thể đã bị xóa khỏi dữ liệu.',
      'adminVendors.detail.back': 'Về danh sách thợ',
      'adminVendors.detail.loadError': 'Không tải được thông tin thợ',
      'adminVendors.detail.retry': 'Thử lại',
      'adminVendors.section.activity': 'Hoạt động',
      'adminVendors.section.account': 'Tài khoản đăng nhập',
      'adminVendors.field.rating': 'Đánh giá',
      'adminVendors.field.jobs': 'Đơn hoàn thành',
      'adminVendors.field.status': 'Trạng thái nhận đơn',
      'adminVendors.field.wallet': 'Số dư ví thợ',
      'adminVendors.field.created': 'Ngày tạo',
      'adminVendors.field.password': 'Mật khẩu',
      'adminVendors.pw.temp': 'Mật khẩu tạm, thợ chưa đổi',
      'adminVendors.pw.set': 'Thợ đã tự đặt',
      'adminVendors.pw.missing': 'Chưa có mật khẩu — hãy đặt lại',
      'adminVendors.commission.own': '{rate}% (riêng)',
      'adminVendors.commission.default': '{rate}% (mặc định)',
      'adminVendors.lockedNote': 'Tài khoản đang bị khóa',
      'adminVendors.lockedSince': 'Từ {date}',
      'adminVendors.lockedReason': 'Lý do: {reason}',
      'adminVendors.btn.edit': 'Sửa thông tin',
      'adminVendors.btn.reset': 'Đặt lại mật khẩu',
      'adminVendors.btn.lock': 'Khóa tài khoản',
      'adminVendors.btn.unlock': 'Mở khóa tài khoản',
      'adminVendors.btn.cancel': 'Hủy',
      'adminVendors.btn.close': 'Đóng',
      'adminVendors.btn.working': 'Đang xử lý…',
      'adminVendors.lock.title': 'Khóa tài khoản thợ?',
      'adminVendors.lock.body': '{name} sẽ không đăng nhập được và tự tắt "Sẵn sàng nhận đơn". Đơn đang thực hiện không bị thay đổi.',
      'adminVendors.lock.reason': 'Lý do (tùy chọn)',
      'adminVendors.lock.reasonPh': 'Ví dụ: vi phạm quy định, thợ nghỉ việc…',
      'adminVendors.lock.confirm': 'Khóa',
      'adminVendors.unlock.title': 'Mở khóa tài khoản?',
      'adminVendors.unlock.body': '{name} sẽ đăng nhập lại được bằng mật khẩu hiện tại.',
      'adminVendors.unlock.confirm': 'Mở khóa',
      'adminVendors.reset.title': 'Đặt lại mật khẩu?',
      'adminVendors.reset.body': 'Hệ thống tạo mật khẩu tạm mới cho {name}. Mật khẩu cũ không dùng được nữa và thợ phải đổi mật khẩu ở lần đăng nhập tới.',
      'adminVendors.reset.confirm': 'Đặt lại',
      'adminVendors.reset.doneTitle': 'Đã đặt lại mật khẩu',
      'adminVendors.reset.warn': 'Mật khẩu chỉ hiện một lần. Đóng cửa sổ này là không xem lại được; hãy gửi cho thợ ngay.',
      'adminVendors.toast.locked': 'Đã khóa tài khoản.',
      'adminVendors.toast.unlocked': 'Đã mở khóa tài khoản.',
      'adminVendors.toast.updated': 'Đã lưu thay đổi.',
      'adminVendors.toast.noChange': 'Không có thay đổi nào để lưu.',
      'adminVendors.err.generic': 'Thao tác không thành công. Vui lòng thử lại.',
      'adminVendors.edit.title': 'Sửa thông tin thợ',
      'adminVendors.edit.intro': 'Tên đăng nhập không đổi được. Nếu thợ quên mật khẩu, dùng "Đặt lại mật khẩu" ở trang chi tiết.',
      'adminVendors.edit.submit': 'Lưu thay đổi',
      'adminVendors.edit.submitting': 'Đang lưu…',
      'adminVendor.loadError': 'Không tải được dữ liệu biểu mẫu',
      'adminVendor.retry': 'Thử lại',
      'adminVendor.done.title': 'Đã tạo tài khoản',
      'adminVendor.done.sub': '{name} có thể đăng nhập bằng thông tin dưới đây.',
      'adminVendor.done.username': 'Tên đăng nhập',
      'adminVendor.done.password': 'Mật khẩu tạm',
      'adminVendor.done.warn': 'Mật khẩu chỉ hiển thị một lần tại đây. Hãy gửi cho thợ ngay; thợ sẽ phải đổi mật khẩu khi đăng nhập lần đầu.',
      'adminVendor.done.warnTitle': 'Lưu ý',
      'adminVendor.done.copyAll': 'Sao chép thông tin đăng nhập',
      'adminVendor.done.another': 'Tạo tài khoản khác',
      'adminVendor.done.back': 'Về danh sách thợ',
      'adminVendor.copy.header': 'Tài khoản TingTingVac',
      'adminVendor.copy.name': 'Tên',
      'adminVendor.copy.login': 'Đăng nhập tại',
      'adminVendor.noServices': 'Chưa có dịch vụ nào trong hệ thống.'
    },
    en: { 'common.loading': 'Loading…', 'common.save': 'Save', 'common.cancel': 'Cancel', 'common.error': 'An error occurred' }
  };
  var locale = 'vi';
  function t(key, params) {
    var value = (dictionaries[locale] && dictionaries[locale][key]) || (dictionaries.vi && dictionaries.vi[key]) || key;
    params = params || {};
    return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, function (all, name) { return params[name] == null ? all : String(params[name]); });
  }
  function setLocale(next) { if (!dictionaries[next]) throw new Error('Ngôn ngữ chưa được hỗ trợ: ' + next); locale = next; return locale; }
  function money(value, opts) {
    var n = Number(value); if (!Number.isFinite(n)) n = 0;
    return new Intl.NumberFormat((opts && opts.locale) || 'vi-VN', { maximumFractionDigits: 0 }).format(n) + ((opts && opts.currency) === false ? '' : ' ₫');
  }
  function date(value, opts) {
    var d = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    var options = Object.assign({ day: '2-digit', month: '2-digit', year: 'numeric' }, opts || {});
    return new Intl.DateTimeFormat((opts && opts.locale) || 'vi-VN', options).format(d);
  }
  function relativeTime(value, now) {
    var d = value instanceof Date ? value : new Date(value), ms = d.getTime();
    if (!Number.isFinite(ms)) return '';
    var delta = ms - (now == null ? Date.now() : Number(now)), abs = Math.abs(delta), unit, amount;
    if (abs < 45000) return 'vừa xong';
    if (abs < 3600000) { unit = 'minute'; amount = Math.round(delta / 60000); }
    else if (abs < 86400000) { unit = 'hour'; amount = Math.round(delta / 3600000); }
    else if (abs < 2592000000) { unit = 'day'; amount = Math.round(delta / 86400000); }
    else if (abs < 31536000000) { unit = 'month'; amount = Math.round(delta / 2592000000); }
    else { unit = 'year'; amount = Math.round(delta / 31536000000); }
    try { return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(amount, unit); }
    catch (_) { return amount < 0 ? Math.abs(amount) + ' ' + ({ minute: 'phút', hour: 'giờ', day: 'ngày', month: 'tháng', year: 'năm' }[unit]) + ' trước' : amount + ' ' + unit + ' nữa'; }
  }
  function maskPhone(phone) {
    var raw = String(phone == null ? '' : phone), digits = raw.replace(/\D/g, '');
    if (digits.length < 7) return raw;
    var start = digits.length >= 10 && digits.slice(0, 2) === '84' ? 3 : 3;
    var end = 3, hidden = digits.length - start - end;
    if (hidden < 3) { start = Math.max(1, Math.floor((digits.length - 3) / 2)); hidden = digits.length - start - 3; }
    var masked = digits.slice(0, start) + '*'.repeat(Math.max(3, hidden)) + digits.slice(-end);
    if (raw.trim().charAt(0) === '+') return '+' + masked;
    return masked;
  }
  function id() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    var bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes); else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function orderCode(value) {
    var hex = String(value || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
    if (hex.length < 8) hex = (hex + id().replace(/-/g, '').toUpperCase()).slice(0, 8);
    return '#' + hex.slice(0, 8);
  }
  function audit(action, details) {
    details = details || {};
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem('ttv_session') || 'null'); } catch (_) {}
    var record = {
      id: id(), actor_id: details.actor_id || (session && (session.account_id || session.user_id)) || 'system',
      actor_role: details.actor_role || (session && (session.role || session.account_type)) || 'SYSTEM',
      action: String(action || 'unknown'), target_table: details.target_table || '', target_id: details.target_id == null ? '' : String(details.target_id),
      detail: details.detail == null ? '' : (typeof details.detail === 'string' ? details.detail : JSON.stringify(details.detail)),
      created_at: new Date().toISOString()
    };
    if (!TTV.Store || typeof TTV.Store.put !== 'function') return Promise.reject(new Error('Store chưa sẵn sàng để ghi audit log.'));
    return TTV.Store.put('audit_logs', record).then(function () { return record; });
  }
  TTV.I18n = { t: t, setLocale: setLocale, getLocale: function () { return locale; }, dictionaries: dictionaries };
  TTV.Utils = {
    money: money, date: date, relativeTime: relativeTime,
    maskPhone: maskPhone, id: id, orderCode: orderCode, audit: audit
  };
  TTV.audit = audit;
})(window.TTV);
