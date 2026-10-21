# CLAUDE.md — Ứng dụng đặt bốc vác (TTV)

Web app giả lập mobile cho dịch vụ đặt thợ bốc vác. Có 3 vai trò: **Khách**, **Thợ/Tổ đội/Công ty**, **Admin**. 🔁 **Admin chỉ có MỘT vai trò duy nhất `SUPER_ADMIN`** (đã bỏ `ADMIN` và `SUPPORT`, không phân quyền con). Không có backend thật, dữ liệu lưu ở IndexedDB (local) hoặc `window.kioStore` (KIO, bảng prefix `ttv_`).

> Ký hiệu **🆕** đánh dấu nội dung được bổ sung sau khi đối chiếu với file Excel `TingTingVac.xlsx` (27 màn hình, 44 ảnh chụp từ app thật `tingtingvac.com`).

---

## 0. Cách làm việc với file này

1. **Mỗi lần chỉ làm 1 task** trong mục "Kế hoạch triển khai" (ví dụ `3.2`). Không nhảy cóc, không làm thêm task khác.
2. Trước khi code: đọc mục 1–6 (ngữ cảnh, quy ước, nghiệp vụ, DB) và task đang làm.
3. 🆕 Với task có màn hình khách: **mở ảnh tham chiếu tương ứng** trong `docs/reference/` (tên file `NN-ten-man-hinh-k.jpg`, bảng tra ở mục 12) và bám bố cục, nhãn chữ, trạng thái nút trong ảnh.
4. Làm xong: kiểm tra đủ **Tiêu chí xong** của task, tick `[x]` ở checklist, rồi dừng và báo lại những gì đã làm.
5. Task nào bị chặn vì thiếu thông tin thì ghi vào mục "Câu hỏi mở" (cuối file), không tự đoán lớn.
6. Không sửa các bảng/route/quy tắc đã chốt ở đây mà không hỏi. Nếu cần đổi, đề xuất trước, sửa file này sau khi được duyệt.
7. Ưu tiên chạy được và demo được sớm: mỗi giai đoạn kết thúc phải mở được trên trình duyệt và thử được luồng chính.
8. 🆕 **Giao file sau mỗi task**: chỉ đóng gói (zip) **những file đã sửa hoặc thêm mới** trong task đó, giữ **đúng cấu trúc thư mục** gốc (thư mục ngoài cùng `ttv/`, ví dụ `ttv/js/screens/auth.js`, `ttv/css/style.css`), để người dùng giải nén đè lên project là xong. **Không** zip lại cả project. Nhớ gồm cả `CLAUDE.md` (đã tick) và `index.html` nếu có thêm script hoặc đổi `?v=`. Tên file zip gợi ý: `ttv-task-<số task>.zip`.
9. 🆕 **Luôn làm trên KIO và lưu bảng với tên `ttv_<tên bảng>`** (ví dụ `ttv_users`, `ttv_orders`, `ttv_user_coupons`, `ttv_wallet_transactions`). Driver mặc định là `kio` (`?driver=kio`); `?driver=local` (IndexedDB) chỉ để test offline, **không** phải nơi chạy chính. Màn hình/`ttv-api.js` luôn gọi `TTV.Store` bằng tên bảng **gốc không prefix** (`'orders'`, `'coupons'`…); `store.js` tự ghép thành tên bảng KIO = `ttv_` + tên bảng viết thường (`__meta` → `ttv_meta`). **Không** tự gõ `ttv_` trong code màn hình và **không** gọi `KioStore` trực tiếp. Bảng mới: thêm tên vào `TABLES` trong `store.js` (KIO tự tạo bảng ở lần ghi đầu bằng `appendCollection`), mọi bản ghi phải có `id` (hoặc `code`/`key`), ghi vào mục 5 và seed nếu cần. Nhớ KIO không có giao dịch (xem mục 4 "Đồng thời") và cache đọc 30 giây.

---

## 1. Ngữ cảnh và ràng buộc

- **Nguồn thiết kế**: file Excel gốc (27 màn hình, 44 ảnh, giao diện xanh dương, mobile-first, bottom tab 4 mục cho khách). 🆕 Ảnh đã được tách ra `docs/reference/` (2,8 MB, đã đặt tên theo màn hình). Phần mô tả trong Excel chỉ cho **khu khách**; khu thợ và admin do ta tự thiết kế.
- **Tham chiếu kiến trúc**: repo HRM (README). **Chưa đọc được** `kio-api.js` và `store.js` của HRM (GitHub chặn truy cập tự động), nên lớp `store.js` hiện bám theo giao diện `list/get/put/remove/query`. Khi người dùng dán 2 file đó, chỉnh lại cho khớp.
- **Công nghệ** 🆕 (theo mẫu repo `hrm-frontend`): JavaScript thuần, **script thường — không ES module**, không build, không framework, không bundler. Mọi module gắn vào namespace toàn cục `window.TTV`; `index.html` nạp `<script>` theo thứ tự (có `?v=N` để phá cache, thêm file mới vào `index.html` khi làm task). Cấu hình ở `window.TTV_CONFIG` trong `index.html` (`mode`, `prefix`, `seedUser`, `seedPassword`). **Chạy bằng web server tĩnh, không dùng Python**: `npx serve .` hoặc XAMPP (mở qua http, không `file://`). Chỉ một file CSS `css/style.css`.
- **Giao diện**: toàn bộ ứng dụng nằm trong khung giả lập app mobile rộng tối đa 430px, căn giữa trên desktop và chiếm toàn màn hình trên điện thoại. Router theo hash. Không có sidebar hoặc layout desktop rộng ở bất kỳ vai trò nào.
- 🆕 **Phong cách thị giác (rút từ ảnh Excel, lấy mẫu pixel lại ở task 1.1)**:
  - Header trang con: nền gradient ngang xanh đậm → xanh nhạt (xấp xỉ `#0643A0` → `#60C0FB`), tiêu đề trắng căn giữa, nút quay lại `‹` bên trái; header lớn ở Trang chủ/Ví/Cá nhân bo góc dưới.
  - Màu chủ đạo xấp xỉ `#1B7BE4`; nút chính gradient xanh, bo tròn, **full width, dính đáy màn hình**; nút vô hiệu hóa màu xám.
  - Thẻ trắng bo góc lớn, đổ bóng nhẹ; chip chọn (trọng lượng, loại địa chỉ…) bo tròn, chip đang chọn nền xanh/viền xanh.
  - Bottom tab 4 mục (Trang chủ / Ví / Lịch sử / Cá nhân), mục đang ở sáng xanh.
  - Bảng màu trạng thái: Đang tìm thợ = cam, Đã hủy = xám, Hoàn thành = xanh lá/xám nhạt, Đang xử lý (giao dịch) = cam với biểu tượng đồng hồ.
  - Lời nhắc cảnh báo dùng khung vàng nhạt có icon `ⓘ` (ví dụ lưu ý mã giảm giá).
- **Bảo mật**: kiểm quyền chỉ là rào cản phía trình duyệt, chỉ phù hợp bản demo. Ghi chú rõ điều này trong README.
- **Trình duyệt mục tiêu**: Chrome/Edge trên máy tính (do File System Access API cho upload).

---

## 2. Kiến trúc và cấu trúc thư mục

```
UI (js/app.js + js/screens/*)
  → js/api/ttv-api.js   (nghiệp vụ, tính giá, trạng thái đơn)
  → js/api/store.js     (list/get/put/remove/query)
  → KIO qua js/api/kio-api.js (?driver=kio, MẶC ĐỊNH, bảng tên ttv_<bảng>) | IndexedDB (?driver=local, chỉ để test offline)
```

```
index.html
css/        style.css            (biến thiết kế + reset + khung 430px; chỉ 1 file, như HRM)
README.md   (cách chạy: npx serve . / XAMPP)
docs/reference/   🆕 ảnh tham chiếu từ Excel (44 file .jpg)
uploads/    (seed/ được commit, phần còn lại vào .gitignore)
js/app.js    (điểm vào UI)
js/api/     kio-api.js (đã có, nguyên văn từ công ty) · store.js · ttv-api.js · pricing.js · sim.js · map-service.js · upload.js · auth.js
js/screens/ auth · home · create-order · quotes · orders · order-detail · addresses · wallet · coupons
            · profile · settings · help
            · vendor/*   (khu thợ)
            · admin/*    (khu admin)
js/ui/      router.js · components.js (header, tab, toast, modal, sheet) · i18n.js · app.js
```

Quy tắc phân lớp:
- Màn hình **không** gọi `store` trực tiếp; luôn đi qua `ttv-api.js`.
- Mọi logic tính tiền nằm trong `pricing.js`, không rải trong màn hình.
- Mọi hệ số giá, hoa hồng, thời gian chờ đọc từ bảng cấu hình (`pricing_config`, `app_settings`), không hard-code.

---

## 3. Vai trò, đăng nhập, route

### Quy chuẩn giao diện bắt buộc: mọi khu vực đều là khung giả lập app mobile

- **Toàn bộ giao diện ứng dụng** phải được trình bày bên trong khung thiết bị mobile giả lập: khu khách, khu thợ, khu admin, đăng nhập, đổi mật khẩu, onboarding, modal/bottom sheet và các màn phụ. Không tạo layout desktop kiểu website quản trị.
- Khung có chiều rộng tối đa **430px**, căn giữa trên desktop; trên điện thoại thật sử dụng toàn bộ chiều rộng và chiều cao khả dụng. Không dùng `.is-wide`, sidebar hoặc bảng quản trị trải ngang.
- Trên desktop chỉ phần nền bên ngoài khung được phép rộng; nội dung ứng dụng không vượt khỏi khung. Mọi danh sách, form, header, modal và điều hướng phải căn theo chiều rộng mobile.
- Với dữ liệu dạng bảng, thiết kế **danh sách/thẻ mobile** là mặc định. Chỉ dùng bảng khi thực sự cần so sánh nhiều trường; khi đó bảng phải nằm trong vùng cuộn ngang có chủ đích bên trong khung, không làm rộng khung app.
- Dùng chung quy tắc khung mobile cho mọi vai trò; màu sắc và điều hướng có thể khác theo vai trò nhưng kích thước và nguyên tắc responsive phải nhất quán. Không thay đổi API, nghiệp vụ hoặc route hiện có chỉ để phục vụ giao diện.

| Vai trò | Đăng nhập | Route gốc | Giao diện |
|---|---|---|---|
| Khách (`CUSTOMER`) | `/login`: SĐT +84 + OTP, Zalo (demo), Google (demo) | `#/home`, `#/create/order`, `#/orders`… | Giả app mobile, bottom tab: Trang chủ / Ví / Lịch sử / Cá nhân |
| Thợ (`VENDOR`) | `/staff-login`: username + mật khẩu do admin cấp, bắt đổi mật khẩu lần đầu. 🔁 Không cần duyệt giấy tờ: tài khoản admin tạo xong là dùng được ngay | `#/vendor/*` | Giả app mobile riêng, có bottom tab |
| Admin (chỉ `SUPER_ADMIN`) | `/staff-login`: username + mật khẩu. Tài khoản đầu `admin` / `Admin@12345`, bắt đổi lần đầu | `#/admin/*` | Cùng khung giả app mobile; không sidebar, điều hướng bottom tab + mục “Thêm” |

- Mật khẩu băm SHA-256 + salt bằng `crypto.subtle`.
- Session lưu theo tab (để mở 3 tab test 3 vai trò cùng lúc). Mỗi vai trò poll KIO 3–5 giây để thấy đơn mới, báo giá mới.
- 🔁 **Quyền admin**: chỉ có **một** vai trò `SUPER_ADMIN`, đăng nhập vào `#/admin/*` là có **toàn quyền** (khách, thợ, đơn, tài chính, khuyến mãi, nội dung, cấu hình giá/hệ thống, nhật ký). **Không** có ma trận quyền, không ẩn/khóa menu theo vai trò, không có màn quản lý tài khoản admin (không tạo thêm `ADMIN`/`SUPPORT`). Tài khoản `admin` do seed tạo; đổi mật khẩu ở `#/change-password`. Guard chỉ phân biệt 3 nhóm: `CUSTOMER`, `VENDOR`, `SUPER_ADMIN`.

### 🆕 Bảng route khu khách (đối chiếu URL app thật)

| Màn hình (Excel) | URL app thật | Route của ta |
|---|---|---|
| Đăng nhập / OTP | `/login` | `#/login`, `#/login/otp` |
| Hoàn tất thông tin | — | `#/onboarding` |
| Trang chủ | `/dashboard` | `#/home` |
| Thông báo | — | `#/notifications` |
| Đặt đơn bốc vác | `/create/order` | `#/create/order?service=…` |
| Sổ địa chỉ / Thêm / Sửa | `/address`, `/address/edit?id=` | `#/address`, `#/address/new`, `#/address/edit/:id` |
| Đang nhận báo giá | — | `#/orders/:id/quotes` |
| Mã giảm giá | — | `#/coupons` |
| Ví / Nạp / Lịch sử GD | `/wallet`, `/wallet/deposit`, `/wallet/history` | `#/wallet`, `#/wallet/deposit`, `#/wallet/history` |
| Cổng thanh toán giả | — | `#/pay/:txId` |
| Đơn hàng / Chi tiết | `/job/:id` | `#/orders`, `#/orders/:id` |
| Cá nhân / Thông tin cá nhân | — | `#/profile`, `#/profile/info` |
| Cài đặt / Cài đặt thông báo | — | `#/settings`, `#/settings/notifications` |
| Phương thức thanh toán | — | `#/payment-methods` |
| Đánh giá của tôi | — | `#/reviews` |
| Bảo mật / Thiết bị | — | `#/security`, `#/security/devices` |
| Lịch sử báo cáo | — | `#/reports` (+ `#/reports/new`) |
| Trợ giúp / FAQ / Điều khoản | — | `#/help`, `#/faq?tab=`, `#/policies?tab=` |

### Giả lập các dịch vụ ngoài

| Thực tế | Cách giả lập |
|---|---|
| OTP SMS | Mã cố định `123456` hiện trong toast, sai 5 lần thì khóa tạm, đếm ngược gửi lại. 🆕 Chỉ nhận mã vùng Việt Nam (+84) |
| Zalo / Google login | Nút tạo tài khoản demo |
| VNPay / Momo | Màn "cổng thanh toán giả" có nút Thành công / Thất bại, giao dịch pending → success/failed |
| Thợ báo giá (bot demo) | Với mọi đơn (🔁 không còn phân biệt 1 thợ / ≥ 2 thợ), sau vài giây sinh 2–4 báo giá từ các thợ/tổ đội **đủ điều kiện nhận đơn** trong bảng `vendors` (xem mục 4 "Điều kiện nhận đơn"). Admin bật/tắt bằng `app_settings`. Panel ẩn `#/sim` để đẩy trạng thái đơn |
| Bản đồ VietMap | Leaflet + OSM, tìm địa chỉ bằng Nominatim, bọc trong `map-service.js` để thay được bằng VietMap sau |
| PDF chi tiết đơn | `window.print()` + CSS print |
| 🆕 Gọi tổng đài / gửi email hỗ trợ / nút Zalo | `tel:` và `mailto:` lấy từ `app_settings` (hotline, support_email); nút Zalo mở `https://zalo.me` (app thật chỉ mở trang chủ Zalo, chưa có Zalo OA của dịch vụ) |

### 🆕 Mục "chưa cài đặt" ở app gốc: hiển thị nhưng khóa, nhãn **"Sắp có"**

Thêm điểm trả, Đặt lịch, tiếng Anh, dark mode (làm ở giai đoạn 9), đăng nhập sinh trắc học, đổi mã PIN, Chat Zalo OA. Riêng:
- **Nút đánh dấu (bookmark)** ở Chi tiết đơn: app gốc không có công dụng → ta hiển thị nhưng không làm gì (hoặc ẩn), không tính là lỗi.
- **"Khám phá thêm"** ở Trang chủ: thẻ ảnh, không click được.
- **Đặt lại**: app gốc *chưa tự điền* thông tin; ta **làm tốt hơn** (điền sẵn, task 6.4).

### 🆕 Lỗi của app gốc KHÔNG sao chép

- Mọi đơn đều hiện "Bốc xếp nội thất" → ta hiển thị đúng dịch vụ đã chọn.
- Thông báo hiện nguyên UUID đơn → ta hiển thị mã đơn ngắn `#XXXXXXXX`.
- Ví sau khi nạp thất bại/đang xử lý mãi → ta có cổng giả để kết thúc giao dịch.

---

## 4. Quy tắc nghiệp vụ

### Giá
- `giá tự tính = giá cơ bản(dịch vụ) + phí trọng lượng + phí tầng + phí khoảng cách`, rồi nhân hệ số tốc độ.
- Phí tầng = số tầng × đơn giá; **giảm 70% nếu có thang máy**; tính riêng nơi bốc và nơi dỡ.
- Tốc độ: Mặc định ×1, Nhanh ×1,25, Gấp ×1,5 (Gấp tăng dần theo thời gian).
- Số tiền khách trả tối thiểu **10.000đ**.
- 🆕 **Phân biệt 2 con số** (rất dễ nhầm): 
  - `price_breakdown` / giá tự tính = **giá tham khảo** hệ thống tính (hiện thành 4 dòng: Giá cơ bản, Phí trọng lượng (mức), Phí tầng (bốc + dỡ), Phí khoảng cách (x km)).
  - `user_offer` = **"Số tiền bạn trả"** trên form = **số tiền tối đa khách chấp nhận trả** (≥ 10.000đ). Ở app gốc, "Tổng tiền" trong Chi tiết đơn và số tiền trong danh sách/modal xác nhận trước khi ghép thợ đều là `user_offer`, **không** phải tổng 4 dòng. Ví dụ ảnh: 4 dòng cộng ≈ 152.900đ nhưng khách đặt tối đa 30.000đ.
  - 🆕 **`final_price` (số tiền khách thực trả) ✅ đã chốt**: = **giá báo giá của thợ/tổ đội được khách chọn** (đã qua các lựa chọn áp dụng như mã giảm giá nếu có). 🔁 Vì mọi báo giá đều **≤ `user_offer`** nên `final_price` luôn ≤ `user_offer` (không còn trường hợp "vượt mức tối đa"). Khi chọn thợ/ghép thợ: hoàn phần chênh lệch `user_offer − final_price` (đã tạm giữ nếu trả ví).
  - 🆕 Chi tiết đơn: trước khi ghép thợ, dòng tiền hiện nhãn "Số tiền tối đa bạn trả" = `user_offer`; sau khi ghép thợ hiện "Tổng tiền" = `final_price`.
- 🆕 **Số liệu suy ra từ ảnh (đưa vào seed 1.6, admin sửa được ở 3.6)**: ảnh mẫu: giá cơ bản 50.000đ, trọng lượng Vừa 57.000đ (chỉ để đối chiếu); phí tầng 15.000đ/tầng (2 tầng bốc có thang máy + 2 tầng dỡ không thang = 2×15.000×0,3 + 2×15.000 = 39.000đ ✔); phí km 5.000đ/km (1,38 km → 6.900đ ✔). 🆕 **✅ Tạm thời (đã chốt)**: giá cơ bản của 6 dịch vụ còn lại = **100.000đ**; phí trọng lượng của cả 4 mức (Nhẹ/Vừa/Nặng/Rất nặng) = **100.000đ**. Chuyển nhà giữ giá cơ bản 50.000đ. Admin chỉnh được ở task 3.6. (Con số 57.000đ ở ảnh mẫu bị thay bằng 100.000đ.)
- 🆕 Khoảng cách hiển thị 2 chữ số thập phân trong form/báo giá (1,38 km), làm tròn 1 chữ số ở Chi tiết đơn (1,4 km).

### Loại đơn
🔁 **Gộp quy trình: mọi đơn (1 thợ hay ≥ 2 thợ) đều theo cùng một quy trình báo giá** (đã chốt, thay cho tách "đơn 1 thợ = đấu giá" và "đơn ≥ 2 thợ = giá cố định"):
1. Khách đặt đơn với số tiền tối đa (`user_offer`), số thợ cần (`workers`), loại nhà cung cấp.
2. **Nhiều thợ / tổ đội / công ty khác nhau cùng gửi báo giá** (kèm ETA, lời nhắn). Mỗi nhà cung cấp chỉ có **1 báo giá hiệu lực** cho mỗi đơn; **báo giá ≤ `user_offer`**.
3. **Khách xem danh sách báo giá (thấp → cao) và tự chọn** nhà cung cấp mong muốn (không còn "ai bấm trước được").
4. Nhà cung cấp **sửa/rút báo giá được khi chưa được chọn**; được chọn thì không rút được.

**Điều kiện nhận đơn** (khác biệt duy nhất giữa đơn ít thợ và nhiều thợ; dùng chung cho Chợ đơn 5.2, Chi tiết đơn 5.3, gửi báo giá 5.4 và bot demo 5.9; API kiểm lại ở phía ghi):
- **Thợ cá nhân** (`type = personal`, `team_size = 1`): chỉ nhận đơn **1 thợ**. **Không** nhận đơn yêu cầu ≥ 2 thợ. **Đồng thời chỉ 1 đơn**: đang có đơn `matched`/`arriving`/`working` (hoặc đang có báo giá `pending` chờ khách chọn) thì không thấy/không báo giá đơn khác; hoàn thành (hoặc rút báo giá/đơn hủy) rồi mới nhận đơn tiếp theo.
- **Tổ đội / Công ty** (`type = team|company`): chỉ nhận đơn khi **số thợ rảnh ≥ số thợ khách yêu cầu** (`workers`). Số thợ rảnh = `team_size` − tổng `workers` của các đơn đang `matched`/`arriving`/`working`. Ví dụ đội 5 đang làm đơn 2 thợ thì còn 3 rảnh: không nhận (không thấy / không báo giá / khách không chọn được) đơn 4 thợ; chỉ nhận đơn ≤ 3 cho tới khi hoàn thành và đủ người. Báo giá `pending` **không** giữ slot đội (khác cá nhân).
- Tức là điều kiện chung: `workers ≤` người rảnh (cá nhân: tối đa 1 đơn, `team_size = 1`). Ngoài ra vẫn phải khớp loại nhà cung cấp khách chọn, dịch vụ và khu vực (xem "Báo giá (thợ)").
- Khách chọn **Loại nhà cung cấp**: "Cá nhân" bị khóa khi số thợ ≥ 2 (vì cá nhân không nhận được); "Không quan trọng" thì chỉ các nhà cung cấp đủ điều kiện ở trên mới thấy đơn.

**Mã giảm giá**: 🔁 hiện vẫn chỉ áp dụng cho đơn **≥ 2 thợ** (giữ nguyên quy tắc cũ, xem "Câu hỏi mở" mục 11: có giữ không khi đã gộp quy trình). Màn Mã giảm giá luôn hiện khung cảnh báo vàng giải thích điều này. Đơn 1 thợ **không** dùng mã giảm giá.

🔁 **Đã bỏ** (do gộp quy trình): khái niệm "giá cố định" cho đơn ≥ 2 thợ và luồng "Vượt mức tối đa +x đ → Chấp nhận / Không" ở màn Đang nhận báo giá (vì báo giá không thể vượt `user_offer`).

### Trạng thái đơn
`finding` → `matched` → `arriving` → `working` → `completed`, hoặc `cancelled`.
- `finding` hết 30 phút không ai nhận thì tự hủy với lý do "Không tìm được thợ".
- Timeline hiển thị 5 mốc (Đã tạo, Đã ghép thợ, Thợ đang đến, Đang bốc vác, Hoàn thành), ẩn khi đơn bị hủy.
- Chỉ đơn `completed` mới được đánh giá.
- 🆕 **Nhãn trạng thái hiển thị cho khách** (4 nhóm lọc ở danh sách đơn): *Đang tìm thợ* = `finding`; *Đang thực hiện* = `matched`/`arriving`/`working`; *Hoàn thành* = `completed`; *Đã hủy* = `cancelled`. Ngoài ra có tab **Tất cả** (tổng 5 tab).
- 🆕 **Nút theo trạng thái ở Chi tiết đơn**: `finding` → "Xem báo giá" + "Hủy đơn"; `cancelled` → "Đặt lại"; `completed` → "Đặt lại" (+ Đánh giá nếu chưa); các trạng thái còn lại không có nút hành động.
- 🆕 **Mã đơn hiển thị** `#` + 8 ký tự hex in hoa (ví dụ `#FF5C5148`), bấm để copy. Thời gian hiển thị dạng tương đối ("8 giờ trước") ở Chi tiết đơn, dạng `dd/MM/yyyy - HH:mm` ở danh sách.

### Báo giá (thợ)
- 🔁 Áp dụng cho **mọi đơn** (cả 1 thợ lẫn ≥ 2 thợ). **Báo giá tối đa bằng số tiền khách đặt** (`user_offer`). Mỗi thợ/tổ đội/công ty chỉ có 1 báo giá hiệu lực cho mỗi đơn; **sửa/rút được khi chưa được chọn**.
- Khách chọn thợ: báo giá đó → `accepted`, các báo giá còn lại → `rejected`, đơn → `matched`. Khách mới thấy SĐT thợ.
- 🆕 **Quyền riêng tư của khách với thợ**: thợ **thấy tên khách ngay từ Chi tiết đơn (5.3)** (kể cả khi chưa báo giá), nhưng **chỉ thấy SĐT khách sau khi được ghép đơn** (đơn là của chính thợ và đã `matched` trở đi). Nếu chưa ghép, API **không** trả SĐT về trình duyệt (không chỉ ẩn bằng giao diện).
- Thợ chỉ thấy đơn khớp: loại nhà cung cấp, **điều kiện nhận đơn theo số thợ** (cá nhân chỉ đơn 1 thợ; tổ đội/công ty có `team_size` ≥ `workers`, xem "Loại đơn"), dịch vụ và khu vực của thợ.
- 🆕 Màn "Đang nhận báo giá" của khách: sắp xếp báo giá **thấp → cao**; trạng thái rỗng có biểu tượng xoay + dòng "Chưa có báo giá nào — đang chờ thợ/tổ đội phản hồi…".

### Ví và tiền
- **Ví khách**: trả bằng ví thì tạm giữ số tiền đặt (`hold`); khi chọn thợ hoàn phần chênh lệch (`refund`); hủy đơn hoàn toàn bộ.
- 🆕 Số dư ví chỉ dùng để thanh toán đơn bốc vác (không rút ra được). Phí giao dịch nạp tiền: 0đ. Giao dịch đang xử lý hiển thị số tiền gạch ngang + nhãn "Đang xử lý".
- **Hoa hồng** mặc định 15% (cấu hình được, có thể riêng theo thợ). Đơn ví: tiền vào ví thợ sau khi trừ hoa hồng. Đơn tiền mặt: hoa hồng trừ từ ví thợ; ví âm quá ngưỡng thì tạm khóa nhận đơn.
- **Rút tiền thợ**: admin duyệt bằng tay.

### Đồng thời
KIO không có giao dịch: **luôn đọc lại trạng thái đơn ngay trước khi ghi** (nhận đơn, chọn thợ, hủy) để giảm xung đột.

### 🆕 Quy tắc form đặt đơn (rút từ ảnh)
- Nút đáy form: khi chưa chọn đủ 2 điểm hiện **"Chọn điểm bốc & điểm trả"** (xám, vô hiệu); đủ rồi đổi thành **"Đặt đơn"**.
- Sau khi chọn 2 điểm: hiện chip khoảng cách "1.38 km" cạnh điểm trả, hiện nút **Hoán đổi**; **"+ Thêm điểm trả (sắp có)"** khóa.
- "Có cần dỡ hàng không" bật thì mới hiện khối "Nơi dỡ hàng" (số tầng + thang máy). Phụ đề: "Thợ bê hàng lên đúng tầng khi giao".
- Số thợ: bộ tăng/giảm 1–10, phụ đề "Chọn tốc độ nhận đơn bên dưới".
- **Tốc độ nhận đơn** là một dòng bấm mở **bottom sheet** gồm 3 lựa chọn radio (Mặc định / Nhanh / Gấp, mỗi cái có mô tả), đoạn giải thích số tiền tự nhập, nhóm chip **Loại nhà cung cấp** (Không quan trọng / Cá nhân / Tổ đội / Công ty; "Cá nhân" bị khóa khi số thợ ≥ 2) và nút **Xong**. Dòng tóm tắt hiện "Mặc định · 30.000đ" (nhãn tốc độ + số tiền).
- **Số tiền bạn trả**: thẻ nổi bật số lớn màu xanh, nút bút chì sửa; chưa nhập hiện "Chưa nhập"; ô nhập có hậu tố "đ" và gợi ý "Tối thiểu 10.000đ"; dòng phụ "Tạm giữ tối đa X trong ví — hoàn phần chênh lệch khi bạn chọn thợ" (khi trả ví).
- Dưới thẻ tiền: 4 dòng giá tự tính, rồi 2 lựa chọn **Tiền mặt / Ví** (Ví kèm "Số dư …đ").
- 🆕 **✅ Ví không đủ số dư** (chọn Ví mà số dư < `user_offer`): chặn nút Đặt đơn/Thanh toán, hiện cảnh báo "Số dư ví không đủ" kèm nút **Nạp tiền** (→ `#/wallet/deposit`, nạp xong quay lại form giữ nguyên dữ liệu) và vẫn cho **đổi sang Tiền mặt** ngay tại chỗ.
- Ảnh: ô "Thêm" nét đứt + đếm "0/7"; ảnh lỗi hiện dòng đỏ "1 ảnh tải không thành công (mạng chậm, tải quá lâu)". Video: dòng "Quay video hiện trạng — Tối đa 2 phút — bằng chứng bổ sung ngoài ảnh"; sau khi có video hiện ô thu nhỏ + "Đã quay video 00:04", nút **Quay lại** và **Xóa**.
- **Modal xác nhận đặt đơn** (bottom sheet): lộ trình 2 điểm + chip khoảng cách, "Phương thức" (Tiền mặt/Ví), "Số tiền bạn trả" lớn, dòng "Thanh toán được thu trước khi ghép thợ", nút **Hủy** và **Thanh toán {số tiền}**. Bấm Thanh toán (🆕 với tiền mặt nút ghi "Đặt đơn") → chuyển sang màn Đang nhận báo giá.

---

## 5. Database (bảng KIO, prefix `ttv_`)

> 🆕 **Quy ước đặt tên**: các bảng dưới đây được lưu trên KIO với tên **`ttv_<tên bảng>`** (ví dụ `users` → `ttv_users`, `user_coupons` → `ttv_user_coupons`). Trong code chỉ dùng tên gốc (`'users'`); `store.js` tự thêm prefix. Mỗi bản ghi phải có `id` (hoặc `code`/`key`).

### Bảng gốc

| Bảng | Trường chính |
|---|---|
| `users` | id, phone, name, email, gender, dob, avatar_path, login_method, kyc_status, default_pay_method, wallet_balance, lang, theme, created_at |
| `addresses` | id, user_id, label, type(home/office/warehouse/other), detail (≤ 250 ký tự), lat, lng, contact_name, contact_phone, is_default |
| `services` | code, name, desc, icon, base_price, unit |
| `pricing_config` | weight_tiers[], floor_fee, elevator_discount(0.7), km_fee, speed_multipliers, min_amount(10000), quote_window_min(30) |
| `orders` | id, code, user_id, service, pickup{addr,lat,lng}, dropoff{…}, distance_km, weight_tier, pickup_floor, pickup_elevator, need_unload, drop_floor, drop_elevator, workers, note, schedule_type, speed(default/fast/urgent/custom), provider_type, user_offer, price_breakdown{base,weight,floor,distance,discount}, total, pay_method, coupon_id, status, vendor_id, final_price, quote_deadline, timeline[], cancel_reason, created_at |
| `order_media` | id, order_id, kind(image/video), path, duration |
| `quotes` | id, order_id, vendor_id, price, eta_min, message, status, created_at. 🔁 Dùng cho **mọi đơn** (mỗi báo giá `price` ≤ `orders.user_offer`) |
| `wallet_transactions` | id, user_id, type(topup/payment/refund/hold), amount, method(vnpay/momo/wallet), status(pending/success/failed), order_id, created_at |
| `payment_methods` | id, user_id, type, is_default, linked_source |
| `coupons` | code, title, condition, min_workers, discount_type, discount_value, max_discount, min_order, expires_at, image_path, services[] (trống = mọi dịch vụ) |
| `user_coupons` | id, user_id, coupon_code, status(available/used/expired), used_order_id |
| `notification_settings` | user_id, order, promo, system, sound_vibrate |
| `reviews` | id, order_id, user_id, vendor_id, rating, comment, tags, created_at |
| `faqs` | id, category(order/payment/wallet/account), question, answer, sort |
| `policies` | type(terms/privacy/refund), content, updated_at |
| `banners` | id, image_path, type(promo/member/explore), target(coupon/none), sort |

### Sửa và thêm cho 3 vai trò

| Bảng | Thay đổi |
|---|---|
| `vendors` (sửa) | + username, password_hash, salt, must_change_pw, status(active/locked), email, team_size, services[], areas[], vehicle, commission_rate, is_online, wallet_balance, avatar_path, created_by. Giữ: name, type(personal/team/company), rating, phone, jobs_done |
| `staff` (mới, thực tế chỉ 1 dòng `admin`) | id, username, password_hash, salt, name, role(chỉ `SUPER_ADMIN`), status, must_change_pw |
| `sessions` (sửa) | id, device_name, platform, last_active, is_current, **account_type(customer/vendor/staff), account_id** |
| `orders` (sửa) | + accepted_quote_id, commission_rate, commission_amount, vendor_earning, cash_collected |
| `order_events` (mới) | id, order_id, event(created/quoted/matched/arriving/working/completed/cancelled), actor_type, actor_id, note, created_at |
| `quotes` (sửa) | + updated_at, withdrawn_at; status: pending/accepted/rejected/**withdrawn/expired** |
| ~~`vendor_documents`~~ | 🔁 **Đã bỏ** cùng task 3.5 (không có giấy tờ thợ, không duyệt) |
| `vendor_transactions` (mới) | id, vendor_id, type(earning/commission/withdraw/adjust), amount, order_id, status, created_at |
| `withdrawals` (mới) | id, vendor_id, amount, bank_name, bank_account, account_holder, status(pending/approved/rejected/paid), reviewed_by, reviewed_at |
| `reports` (sửa) | id, order_id, subject, content, status, created_at + reporter_type, reporter_id, assigned_to, replies[] |
| `broadcasts` (mới) | id, audience(customers/vendors/all), title, body, created_by, created_at |
| `audit_logs` (mới) | id, actor_id, actor_role, action, target_table, target_id, detail, created_at |
| `notifications` (sửa) | id, category(order/promo/system), title, body, order_id, is_read, created_at, **recipient_type + recipient_id** (thay user_id) |
| `noti_marks` (mới, tối ưu realtime) | id = `<recipient_type>:<recipient_id>`, t (mã ngẫu nhiên, đổi mỗi khi hộp thư của người đó thay đổi). Mỗi người 1 dòng rất nhỏ để poll hỏi "có gì mới không" mà không tải bảng `notifications` | — |
| `reviews` (sửa) | + vendor_reply, hidden |
| `app_settings` (mới) | key, value (hoa hồng mặc định, bật bot demo, ngưỡng ví âm…). 🆕 Thêm khóa: `hotline`, `support_email`, `zalo_url`, `quick_topup_amounts` (50k/100k/200k/500k/1M/2M), `topup_fee` (0) |

🆕 Ghi chú bổ sung cho bảng:
- `users.kyc_status` hiển thị ở Trang Cá nhân như một nhãn "trạng thái định danh" (mặc định "Chưa định danh").
- `users.gender` / `dob` do màn Thông tin cá nhân sửa; **SĐT chỉ hiển thị, không sửa**.
- `orders.code` = 8 ký tự hex in hoa lấy từ `id`; chỉ dùng hiển thị.
- `notification_settings.sound_vibrate` ứng với công tắc "Âm thanh & rung".
- `payment_methods`: `type` gồm `wallet`/`cash`; `linked_source` = nguồn nạp ví đã liên kết (vnpay/momo).
- `reports`: bản khách cần xem được danh sách báo cáo mình đã gửi (Lịch sử báo cáo).
- 🆕 (8.1) `users.status` (active/locked), `locked_at`, `lock_reason`; `wallet_transactions.note`, `adjusted_by` cho dòng cộng/trừ thủ công của admin (`method:'admin'`).

Seed ở lần chạy đầu: `services`, `pricing_config`, `vendors` mẫu, `coupons`, `faqs`, `policies`, `banners`, `app_settings`, tài khoản `staff` đầu tiên. 🆕 Coupon mẫu: `TTVNEW10`; một mã đã hết hạn "Giảm giá hè 20%" (đơn tối thiểu 30.000đ, NSD 16/08/2026) để thử tab Hết hạn.

🆕 **7 dịch vụ (đã có trong Excel, dùng cho seed `services`)**:

| Mã | Tên | Mô tả |
|---|---|---|
| `moving` | Chuyển nhà | Chuyển nhà trọn gói, có thợ + xe |
| `warehouse` | Bốc xếp kho | Bốc/dỡ hàng kho, tính theo khối |
| `furniture` | Nội thất | Tháo lắp & vận chuyển đồ nội thất |
| `office` | Văn phòng | Chuyển văn phòng, thiết bị |
| `construction` | Công trình | Bốc xếp vật liệu xây dựng |
| `hourly` | Theo giờ | Thuê thợ bốc vác theo giờ |
| `goods` | Bốc vác hàng hóa | Bốc/dỡ, vận chuyển hàng hóa lẻ |

🆕 **4 mức trọng lượng**: Nhẹ (dưới 30 kg — vài thùng, đồ lặt vặt) · Vừa (30–100 kg — đồ 1 phòng, vài món nội thất) · Nặng (100–300 kg — đồ cả căn hộ) · Rất nặng (trên 300 kg — nhà nguyên căn, kho hàng).

---

## 6. Upload file

- DB **chỉ lưu đường dẫn**. File ghi vào `uploads/` trong source.
- Path: `uploads/{ownerId}/{loại}/{tên-ngẫu-nhiên}.{ext}`. Loại: `avatar`, `order-images`, `order-videos`, `banners`, `coupon-images`. (🔁 đã bỏ `vendor-docs` cùng task 3.5)
- Ghi file bằng File System Access API (`showDirectoryPicker`): người dùng có thể chọn thư mục gốc của project (ứng dụng tự tạo `uploads/`) hoặc chọn trực tiếp thư mục `uploads/`. Lưu handle của chính thư mục `uploads/` trong IndexedDB, hỏi lại quyền khi cần; tránh tạo nhầm `uploads/uploads/`.
- DB chỉ lưu chuỗi đường dẫn tương đối, không lưu blob/base64 hay nội dung file. Hiển thị bằng `<img src="uploads/...">`; thư mục `uploads/` phải nằm bên trong thư mục gốc mà static server phục vụ, nếu không file ghi được nhưng URL sẽ trả lỗi.
- Ảnh được lưu nguyên bản, không resize, không nén và không chuyển đổi định dạng; giữ nguyên byte và phần mở rộng file gốc. Video giữ nguyên, thời lượng ≤ 2 phút, cảnh báo nếu file lớn. Tối đa 7 ảnh/đơn.
- 🆕 Ảnh tải lỗi/quá lâu: ô ảnh hiện trạng thái lỗi và dòng đỏ báo số ảnh lỗi (xem mục 4); không chặn đặt đơn. Video "quay" trên desktop = chọn file video (hoặc `getUserMedia` nếu làm được); có nút **Quay lại** (chọn lại) và **Xóa**, hiện thời lượng `mm:ss`.
- Cột path: `order_media.path`, `users.avatar_path`, `vendors.avatar_path`, `banners.image_path`.
- Ảnh seed đặt trong `uploads/seed/`. `.gitignore` bỏ `uploads/` trừ `uploads/seed/`.
- Giới hạn: chỉ Chrome/Edge desktop, qua `http://localhost` hoặc https.

---

## 7. Quy ước code

- 🆕 **Script thường, không ES module.** Mỗi màn hình tự đăng ký vào namespace: `TTV.screens.orders = { render(container, params) {…}, destroy() {…} }` (`destroy` để dọn timer/poll nếu cần); module khác đăng ký tương tự (`TTV.api`, `TTV.store`, `TTV.pricing`, `TTV.ui`…). Bọc mỗi file trong IIFE khi cần tránh rò biến toàn cục. Thứ tự `<script>` trong `index.html` là thứ tự phụ thuộc.
- Tên route kebab-case, ví dụ `#/create/order`, `#/orders/:id`, `#/vendor/jobs`, `#/admin/withdrawals`.
- Tiền tệ là số nguyên VND; hiển thị bằng `Intl.NumberFormat('vi-VN')` + "đ" (ví dụ `30.000đ`).
- Mọi chuỗi hiển thị đi qua `i18n.js` (mặc định tiếng Việt; tiếng Anh để trống, khóa "Sắp có").
- Mọi thao tác admin ghi `audit_logs` (qua một hàm duy nhất trong `ttv-api.js`).
- Mọi màn hình có trạng thái: đang tải, rỗng, lỗi. 🆕 Trạng thái rỗng theo mẫu app gốc: biểu tượng tròn nhạt + tiêu đề đậm + dòng phụ (ví dụ "Không có thông báo nào / Khi có thông báo mới, bạn sẽ thấy tại đây"; "Chưa có địa chỉ nào / Thêm địa chỉ để đặt đơn nhanh hơn"; "Bạn chưa có mã giảm giá nào / Nhập mã ở trên để nhận ưu đãi cho đơn hàng của bạn").
- Hàm ghi dữ liệu nhạy cảm (ví, đơn, báo giá) kiểm tra lại trạng thái trước khi ghi.
- Comment ngắn bằng tiếng Việt, tên biến/hàm bằng tiếng Anh.
- 🆕 **KIO + `ttv_<bảng>`**: code luôn dùng tên bảng gốc qua `TTV.Store` (`store.js` tự thêm `ttv_`); mọi tính năng mới phải chạy được với `?driver=kio` (mặc định), không chỉ trên IndexedDB. Chi tiết ở mục 0, quy tắc 9.
- 🆕 Lời chào Trang chủ theo giờ (ví dụ "Buổi sáng/trưa/chiều/tối vui vẻ!").

---

## 8. Kế hoạch triển khai

Mỗi task nhỏ, làm xong thì tick. Mỗi giai đoạn có mục **Demo cuối giai đoạn** để tự kiểm tra.

### Giai đoạn 1 — Nền tảng

- [x] **1.1 Khung dự án**: tạo cấu trúc thư mục, `index.html`, `css/style.css` (🆕 một file duy nhất, gồm biến màu/font + reset + khung), `README.md`, `.gitignore`; 🆕 `js/app.js`, `js/api/{kio-api,store,ttv-api}.js` (kio-api.js là bản nguyên văn adapter công ty, store/ttv-api là khung rỗng) và cấu hình `window.TTV_CONFIG` trong `index.html`. 🆕 Giải nén `reference-screens.zip` vào `docs/reference/`; lấy mẫu lại màu từ ảnh để chốt biến màu (xem mục 1).
  *Xong khi*: mở bằng `npx serve .` thấy trang trống có khung 430px căn giữa. 🆕 Có `docs/reference/` với 44 ảnh.
- [x] **1.2 Router hash**: `router.js` hỗ trợ route tĩnh, tham số `:id`, query, guard (kiểm vai trò), 404.
  *Xong khi*: chuyển route không reload, guard chặn được route sai vai trò.
- [x] **1.3 Component dùng chung**: header, bottom tab, toast, modal, bottom sheet, nút, input, empty state, loading. 🆕 Thêm: thẻ, chip chọn, công tắc (toggle), bộ tăng/giảm số (stepper), tab ngang cuộn được, thanh tìm kiếm, nhãn trạng thái (badge), khung cảnh báo vàng, avatar.
  *Xong khi*: có trang `#/sim/components` xem thử tất cả component.
- [x] **1.4 `store.js` driver local**: IndexedDB với `list/get/put/remove/query`, tạo bảng theo mục 5.
  *Xong khi*: thao tác CRUD thử trên một bảng chạy đúng, dữ liệu còn sau khi reload. Đã có IndexedDB `tingtingvac_db`, API `list/get/put/remove/query`, `clear/count/transaction`, và object stores theo mục 5.
- [x] **1.5 `store.js` driver KIO**: cùng giao diện, chọn driver bằng `?driver=local|kio`, prefix `ttv_`. Mặc định **kio**; `?driver=local` thì IndexedDB. `store.js` bọc `KioStore` (`list/get/put/remove/query`, query lọc phía client trên `listCollection`). Tên bảng KIO = `ttv_` + slug chữ thường (`__meta` → `ttv_meta`). Bảng mới lần đầu dùng `appendCollection` để KIO tạo bảng. `audit_logs` / `order_events` luôn append.
  *Xong khi*: đổi driver không phải sửa code màn hình. 🆕 `?driver=kio` chỉ nạp `list.js`/`krud.js` của KIO khi bật (đã có trong `index.html`).
  🆕 **Ghi chú về `KioStore` (adapter công ty cung cấp)**: biến toàn cục `KioStore` (script thường, đã lưu ở `js/api/kio-api.js`), cần nạp `https://kio.dvqt.vn/list.js` và `https://kio.dvqt.vn/krud.js` trước. API: `listRows`, `listCollection(table)`, `syncCollection(table, items)` (thêm/thay theo khóa, **không tự xóa**), `appendCollection` (chỉ thêm, dùng cho `audit_logs`, `order_events`), `deleteKeys(table, keys)`, `replaceCollection`, `saveSingleton`/`loadSingleton`, `invalidateTable`. Mỗi bản ghi JSON bị cắt thành các dòng 120 ký tự trong cột `payload` (bảng chỉ cần `id` + `payload`). Khóa bản ghi lấy theo `id`/`code`/`key`… nên **mọi bản ghi của ta phải có `id` (hoặc `code`/`key`)**; riêng `notification_settings` (đang khóa theo `user_id`) cần thêm `id`. Cache đọc 30 giây, ghi theo từng chunk tuần tự (chậm với bản ghi lớn) → hạn chế ghi dữ liệu lớn, `quotes`/`orders` nên giữ nhỏ gọn, không nhét base64 ảnh.
  *Xong khi*: đổi driver không phải sửa code màn hình.
- [x] **1.6 Seed dữ liệu**: nạp `services` (7 dịch vụ ở mục 5), `pricing_config` (4 mức trọng lượng đều 100.000đ + giá cơ bản 50.000đ cho Chuyển nhà, 100.000đ cho 6 dịch vụ còn lại, xem mục 4), `vendors`, `coupons`, `faqs`, `policies`, `banners`, `app_settings` ở lần chạy đầu.
  *Xong khi*: xóa DB và tải lại thì seed lại đúng một lần. Đã thêm `js/api/seed.js`, tự chạy sau khi mở DB; seed có version marker trong `__meta`, 7 dịch vụ, cấu hình giá, 3 thợ demo, coupon còn hạn/hết hạn, FAQ, policies, banners, app settings và staff `admin`. Không ghi đè các bảng đã có dữ liệu.
- [x] **1.7 Upload service**: `upload.js` chọn thư mục, lưu handle, lưu nguyên ảnh không nén, ghi file, trả về path; hàm kiểm tra video ≤ 2 phút.
  *Xong khi*: upload 1 ảnh thì xuất hiện trong `uploads/…` và hiển thị được bằng `<img>`. Đã thêm `js/api/upload.js`: chọn thư mục gốc, tạo `uploads/`, lưu FileSystemDirectoryHandle trong IndexedDB riêng, xin lại quyền khi cần, lưu ảnh nguyên bản không nén hoặc đổi định dạng, ghi theo `uploads/{ownerId}/{loại}/{tên-ngẫu-nhiên}.{ext}` và kiểm tra thời lượng video không quá 120 giây rồi lưu nguyên byte video vào `uploads/{ownerId}/order-videos/`; trả về path và duration để DB chỉ lưu đường dẫn cùng metadata cần thiết. Demo `#/sim/upload` phải thực sự ghi video, hiển thị đường dẫn, thời lượng và video xem trước (nếu static server phục vụ được URL). Có demo tại `#/sim/upload`; yêu cầu Chrome/Edge qua localhost hoặc HTTPS.
- [x] **1.8 i18n và tiện ích**: `i18n.js`, định dạng tiền/ngày, 🆕 thời gian tương đối ("8 giờ trước"), 🆕 che SĐT (3 số giữa), hàm sinh id/mã đơn (`#` + 8 hex), hàm `audit()`.

**Demo cuối giai đoạn 1**: app chạy, 3 khu vực route rỗng, DB và seed hoạt động, upload thử được.

### Giai đoạn 2 — Auth 3 vai trò và hồ sơ khách

- [x] **2.1 Băm mật khẩu và session**: `auth.js` (SHA-256 + salt), tạo/đọc session theo tab, bảng `sessions`. Đã thêm `js/api/auth.js`: `hashPassword` = SHA-256(`salt:mật khẩu`), `makeCredentials`/`verifyPassword` (dùng lại ở 2.4, 3.2, 3.3), session lưu ở `sessionStorage` khóa `ttv_session` (`{id, role, account_type, account_id, name}`) + một dòng trong bảng `sessions`; `getSession/getRole/createSession/destroySession/touch/listSessions`. Router đã đọc được vai trò qua `TTV.auth.getSession()`.
- [x] **2.2 Đăng nhập khách**: `/login` nhập SĐT +84 (🆕 chỉ hỗ trợ mã vùng Việt Nam), màn OTP (mã `123456`, 5 lần sai thì khóa, đếm ngược gửi lại), nút Zalo/Google tạo tài khoản demo. Đã thêm `js/screens/auth.js` (`#/login`, `#/login/otp`) và phần đăng nhập trong `js/api/ttv-api.js` (`requestOtp/resendOtp/verifyOtp/getOtpState/loginDemo/logout`). SĐT lưu dạng `+84xxxxxxxxx`; sai 5 lần khóa 5 phút theo SĐT (lưu bảng `__meta`, qua F5 vẫn khóa); gửi lại mã sau 60 giây, mã hết hạn sau 5 phút; Zalo/Google dùng tài khoản demo cố định `demo-zalo`/`demo-google`. 🆕 **Ô OTP dùng MỘT `<input>` thật** (6 ô chỉ để hiển thị) và mỗi lần chỉ lọc lại toàn bộ giá trị thành ≤ 6 chữ số — sửa lỗi bộ gõ tiếng Việt Windows (Telex/VNI) gửi chuỗi soạn tích lũy làm "123" thành "112123"; **không quay lại kiểu 6 `<input>` maxlength=1 + tự nhảy ô**. Khách chưa có tên → `#/onboarding`, còn lại → `#/home` (hai màn này đang là **màn tạm** có nút Đăng xuất, sẽ thay ở 2.3 và 4.1).
- [x] **2.3 Onboarding khách**: `/onboarding` họ tên, email, tick điều khoản (🆕 "Đồng ý với Điều khoản sử dụng và Chính sách bảo mật", link mở màn Điều khoản), nút Hoàn tất. 🆕 Hiển thị sau khi xác thực SĐT lần đầu; nút vô hiệu hóa cho tới khi điền đủ + tick. Đã làm trong `js/screens/auth.js` (`renderOnboarding`) + `api.completeOnboarding/getPolicy/isValidEmail`: thẻ "Số điện thoại đã xác thực", họ tên, email (báo lỗi khi rời ô, có giữ chỗ để bố cục không nhảy), tick điều khoản, ghi chú bảo mật, nút Hoàn tất vô hiệu tới khi đủ điều kiện; lưu `name/email/terms_accepted_at` rồi vào `#/home`. **Quay lại** = đăng xuất về `#/login`. Đã có hồ sơ mà vào lại `#/onboarding` thì chuyển về `#/home`. Link Điều khoản/Chính sách tạm mở **bottom sheet** (đọc bảng `policies`) để không mất dữ liệu đang nhập; đổi sang `#/policies?tab=` ở task 9.5.
- [x] **2.4 Đăng nhập staff/thợ**: `/staff-login`, tạo tài khoản `admin` đầu tiên, ép đổi mật khẩu lần đầu. Đã làm trong `js/screens/staff-auth.js` (`#/staff-login`, `#/change-password`) + `api.loginStaff/ensureSeedStaff/changePassword/validatePassword/homeRouteFor`. Tìm tài khoản trong `staff` rồi `vendors` (không phân biệt hoa thường, báo lỗi chung "Sai tên đăng nhập hoặc mật khẩu"); sai 5 lần khóa 5 phút theo username (lưu `__meta`); tài khoản `status=locked` bị chặn. Admin đầu tiên: seed để trống mật khẩu, lúc khởi động `ensureSeedStaff` băm `TTV_CONFIG.seedPassword` (xóa `seed_password_hint`) và đặt `must_change_pw=true`. `must_change_pw` → `#/change-password` (≥ 8 ký tự, có chữ và số, nhập lại khớp, khác mật khẩu cũ), session mang cờ `must_change_pw` để màn tạm chặn vào khi chưa đổi. Staff đăng nhập/đổi mật khẩu ghi `audit_logs` (`auth.login`, `auth.change_password`). `#/admin` và `#/vendor` hiện là **màn tạm** (có `roles` guard), thay ở 3.1 và 5.1; guard/redirect đầy đủ làm ở 2.5. Thợ seed chưa có mật khẩu — tài khoản thợ thật do admin tạo ở 3.3.
- [x] **2.5 Guard theo vai trò**: chuyển hướng đúng khu vực, chặn truy cập chéo, đăng xuất. Đã làm trong `js/ui/router.js` + `js/api/ttv-api.js`: **guard trung tâm** chạy trước mọi route (`Router.checkAccess(path, session)`), khai báo theo khu vực bằng tiền tố route (khớp theo đoạn, `/homework` không bị nhầm với `/home`): khu khách (`/home`, `/profile`, `/orders`, `/wallet`, `/address`…) chỉ `CUSTOMER`; `/vendor/*` chỉ `VENDOR`; `/admin/*` chỉ `SUPER_ADMIN`/`ADMIN`/`SUPPORT`; `/change-password` cho thợ + staff. Chưa đăng nhập → về trang đăng nhập của khu đó (`/login` hoặc `/staff-login`); sai vai trò → về trang chính của vai trò mình kèm toast "Bạn không có quyền truy cập khu vực này."; đã đăng nhập mà vào `/`, `/login`, `/login/otp`, `/staff-login` → vào thẳng khu của mình. Phiên cần đổi mật khẩu (`must_change_pw`) bị ép về `/change-password` ở mọi khu; khách chưa có họ tên (session.name rỗng) bị ép về `#/onboarding` (không còn bỏ qua được bằng cách gõ thẳng `#/home`). Mọi chuyển hướng của guard dùng `navigate(path, {replace:true})` (`location.replace` thật) để nút Back không bị kẹt vòng lặp; `navigate({replace})` cũ chỉ thêm mục lịch sử nên đã sửa. Thêm `Router.has(path)`. `api.validateSession()` chạy lúc khởi động (trước `Router.start`): tài khoản trong phiên không còn (ví dụ xóa DB) hoặc bị khóa → hủy phiên; đồng bộ họ tên và cờ `must_change_pw` từ DB. **Đăng xuất**: `api.logout()` xóa thử thách OTP, bản nháp điểm trả (`ttv_draft_dropoff`) và phiên; staff ghi `audit_logs` `auth.logout`; `api.logoutAndGo()` về đúng trang đăng nhập của vai trò vừa thoát. Route chưa có màn (`/address`, `/settings`…) vẫn nằm trong khu khách nên khi task sau thêm route chỉ cần `Router.add`, không phải sửa guard. 🔁 Ma trận quyền con của admin **đã bỏ** (chỉ còn `SUPER_ADMIN`, xem mục 3); route admin mới chỉ cần `roles:['SUPER_ADMIN']` trong `Router.add`.
- [x] **2.6 Trang Cá nhân và Thông tin cá nhân** (khách): 
  - 🆕 **Cá nhân**: avatar, tên, SĐT che 3 số giữa, số đơn hoàn thành / đang xử lý, nhãn trạng thái định danh; nút chuông → Thông báo; nút bánh răng → Cài đặt; nút sửa/"Thông tin cá nhân"; danh sách mục: Sổ địa chỉ, Phương thức thanh toán, Mã giảm giá của tôi, Đánh giá của tôi, Thông báo, Bảo mật, Lịch sử báo cáo, Trợ giúp & Hỗ trợ, Điều khoản & Chính sách, **Đăng xuất** (các mục chưa có màn thì hiện "Sắp có" tạm, nối dần ở giai đoạn sau).
  - **Thông tin cá nhân**: avatar (upload), họ tên, SĐT (chỉ đọc), email, 🆕 giới tính, 🆕 ngày sinh; lưu thay đổi.
  🆕 *Đã làm* trong `js/screens/profile.js` (`#/profile`, `#/profile/info`, bám ảnh 16 và 18) + `api.getProfileStats/updateProfile/isValidDob/KYC_LABELS/GENDERS`. **Cá nhân**: avatar (có nút bút → Thông tin cá nhân; ảnh lỗi thì hiện chữ cái đầu), tên, SĐT dạng `0358 *** 915`, nhãn định danh (`users.kyc_status`: Chưa định danh / Đang chờ duyệt / Đã định danh / Bị từ chối), chuông (chấm đỏ khi có thông báo chưa đọc) → `#/notifications`, bánh răng → Cài đặt, thẻ thống kê (hoàn thành = `completed`; đang xử lý = mọi đơn chưa `completed` và chưa `cancelled`), 2 nhóm menu đúng thứ tự ảnh, dòng "Phiên bản 1.0.0", nút Đăng xuất có hộp xác nhận. Mục menu mở được khi route đã đăng ký (`Router.has`), nếu chưa thì hiện nhãn **"Sắp có"** và bấm chỉ báo toast — tự sáng lên khi task sau thêm route, không phải sửa `profile.js`; hiện chỉ Thông tin cá nhân là màn thật, Thông báo và Mã giảm giá mở màn tạm. **Thông tin cá nhân**: avatar + "Đổi ảnh" (chỉ xem trước; file ghi vào `uploads/{userId}/avatar/` bằng `TTV.Upload` khi bấm Lưu, nên thoát giữa chừng không để file mồ côi; ảnh ≤ 10 MB, lưu nguyên bản không nén; DB chỉ lưu `avatar_path`), họ tên (2–80 ký tự), SĐT chỉ đọc kèm "Không thể thay đổi" (API cũng bỏ qua mọi giá trị `phone` gửi lên), email (bắt buộc hợp lệ như ở onboarding), giới tính (Nam/Nữ/Khác hoặc chưa chọn), ngày sinh (`<input type="date">`, từ 1900 đến hôm nay, loại ngày không tồn tại như 31/02). Nút Lưu chỉ bật khi có thay đổi và hợp lệ; lưu xong cập nhật tên trong session, toast và về `#/profile`. Các chuỗi mới nằm trong `i18n.js` (khóa `profile.*`).

**Demo cuối giai đoạn 2**: đăng nhập được cả 3 vai trò, đổi mật khẩu lần đầu, đăng xuất, sửa hồ sơ khách.

### Giai đoạn 3 — Admin cơ bản

- [ ] **3.1 Khung admin**: 🔁 khung mobile (bottom tab Tổng quan / Vận hành / Tài chính / Thêm, **không sidebar**), danh sách dùng chung (tìm kiếm, phân trang, lọc). 🔁 **Không phân quyền menu theo role** — mọi mục hiện cho `SUPER_ADMIN`. Đã sửa `js/screens/admin.js` bỏ `ADMIN`/`SUPPORT`, bỏ module "Tài khoản quản trị" và việc khóa tab Tài chính.
- [x] ~~**3.2 Quản lý staff**~~ 🔁 **ĐÃ BỎ** (không còn vai trò `ADMIN`/`SUPPORT` để quản lý). Giữ số thứ tự để các task khác không bị lệch.
- [x] **3.3 Tạo tài khoản thợ**: form đủ trường (tên, loại, SĐT, email, username, mật khẩu tạm có nút sinh ngẫu nhiên + copy, số thợ, dịch vụ (🆕 chọn trong 7 dịch vụ), khu vực, phương tiện, % hoa hồng riêng).
  🆕 *Đã làm* trong `js/screens/admin/vendor-form.js` (`#/admin/vendors/new`, chỉ `SUPER_ADMIN`; vào từ nút **Tạo tài khoản thợ** ở `#/admin/vendors`) + `api.createVendor/validateVendorInput/validateUsername/isUsernameTaken/generateTempPassword` và hằng `api.VENDOR_TYPES/VENDOR_TEAM_LIMITS/VENDOR_AREAS/VENDOR_VEHICLES`; chuỗi chữ trong `i18n.js` (khóa `adminVendor.*`). `admin.js`: `shell(path, title, body, role, opts)` nhận thêm `opts.back` (nút ‹ thay logo) và `opts.hideNav` (ẩn tab dưới cho màn form), được export ở `TTV.screens.admin.shell`. Form là các thẻ trong khung mobile, nút **Tạo tài khoản** dính đáy khung; kiểm tra khi bấm nút, báo lỗi ngay dưới từng ô rồi cuộn tới ô lỗi đầu tiên.
  - **Trường và quy tắc**: *Loại* (Cá nhân / Tổ đội / Công ty, đổi nhãn "Họ và tên thợ / Tên tổ đội / Tên công ty"); *Tên* 2–80 ký tự; *SĐT* chỉ mã vùng VN, lưu dạng `0xxxxxxxxx` (như seed), không trùng thợ khác; *Email* bắt buộc; *Tên đăng nhập* 4–30 ký tự `a-z 0-9 . _ -`, tự đổi sang chữ thường, **duy nhất trên cả `staff` lẫn `vendors`** (đăng nhập tìm cả hai bảng), báo trùng ngay khi rời ô; *Mật khẩu tạm* sinh sẵn 10 ký tự bằng `crypto` (bỏ ký tự dễ nhầm `0 O 1 l I`, luôn có chữ hoa, chữ thường, số), nút **Sinh ngẫu nhiên** và **Sao chép**, được sửa tay, luật như `validatePassword` + không có khoảng trắng; *Số thợ*: cá nhân khóa = 1, tổ đội 2–50, công ty 2–500; *Dịch vụ*: chọn ≥ 1 trong 7 dịch vụ (có nút Chọn tất cả); *Khu vực*: chọn ≥ 1, **"Toàn TP.HCM"** (giá trị `Ho Chi Minh City`, khớp seed) loại trừ các quận/huyện; *Phương tiện*: tùy chọn (gợi ý `<datalist>`); *Hoa hồng riêng*: tùy chọn, 0–100 %.
  - **Bản ghi `vendors` được tạo**: `status='active'`, `must_change_pw=true`, (không có `kyc_status`, 🔁 bỏ cùng 3.5), `rating=0`, `jobs_done=0`, `is_online=false`, `wallet_balance=0`, `avatar_path=''`, `created_by` = id admin tạo, `created_at`; chỉ lưu `salt` + `password_hash`, **không bao giờ lưu mật khẩu rõ**. 🆕 Thêm trường `email` vào `vendors` (bảng ở mục 5 chưa có). 🆕 **`commission_rate = null` nghĩa là dùng mức mặc định `app_settings.commission_default`**; mọi code tính hoa hồng sau này (giai đoạn 7) phải coi `null`/`undefined` là "mặc định", chỉ số cụ thể mới là mức riêng. Hint dưới ô hoa hồng đọc mức mặc định hiện tại.
  - **An toàn ghi**: `createVendor` kiểm quyền (chỉ `SUPER_ADMIN`, nếu không → lỗi `FORBIDDEN`), kiểm tra trùng username/SĐT bằng dữ liệu đọc lại **hai lần** (trước khi băm và ngay trước khi ghi), rồi ghi `audit_logs` với `vendor.create` (chi tiết: username, tên, loại, số thợ, dịch vụ, khu vực, hoa hồng — **không** có mật khẩu, SĐT, email). Lỗi dữ liệu trả về `code: 'VALIDATION'` kèm `err.errors` theo từng trường.
  - **Màn thành công**: hiện tên đăng nhập + mật khẩu tạm **một lần duy nhất** (rời màn là mất, muốn cấp lại phải reset mật khẩu ở 3.4), nút sao chép từng dòng hoặc **Sao chép thông tin đăng nhập** (5 dòng, kèm link `#/staff-login`), **Tạo tài khoản khác** (form sạch + mật khẩu mới), **Về danh sách thợ**. Danh sách thợ thật đã làm ở 3.4. Đã chạy thử: tạo thợ → thợ đăng nhập → bị ép đổi mật khẩu → vào `#/vendor`; `VENDOR` và `CUSTOMER` bị chặn khỏi form.
- [x] **3.4 Danh sách và chi tiết thợ**: khóa/mở, reset mật khẩu, sửa thông tin.
  🆕 *Đã làm* trong `js/screens/admin/vendors.js` (mới: `#/admin/vendors`, `#/admin/vendors/:id`), `js/screens/admin/vendor-form.js` (thêm chế độ sửa `#/admin/vendors/:id/edit`) + `api.listVendors/getVendor/setVendorStatus/resetVendorPassword/updateVendor` (chỉ `SUPER_ADMIN`, nếu không → `FORBIDDEN`); chuỗi chữ trong `i18n.js` (khóa `adminVendors.*`). `admin.js`: module `vendors` có cờ `own:true` để màn riêng tự đăng ký route (route `new` phải đăng ký trước `:id`, router khớp theo thứ tự). Không có ảnh tham chiếu (khu admin tự thiết kế), bám khung mobile + `admin-*` của 3.1/3.3.
  - **Danh sách**: nút **Tạo tài khoản thợ**, ô tìm (tên, tên đăng nhập, SĐT — gõ SĐT bỏ qua dấu cách/chấm, email), chip trạng thái (Tất cả / Hoạt động / Đã khóa, kèm số lượng) và chip loại (Mọi loại / Cá nhân / Tổ đội / Công ty), phân trang 8 dòng. Thẻ thợ: avatar chữ cái, tên, `@username · SĐT`, nhãn loại (+ số thợ), nhãn trạng thái, nhãn "Chờ đổi mật khẩu" khi `must_change_pw`. Sắp xếp mới tạo trước; thợ mẫu (không có `created_at`) xuống cuối. Có trạng thái đang tải / rỗng / không có kết quả / lỗi (có nút Thử lại).
  - **Chi tiết**: đầu trang (avatar, tên, `@username`, nhãn), khung cảnh báo khi đang bị khóa (ngày + lý do), thẻ Thông tin (SĐT, email, số thợ, dịch vụ theo tên, khu vực, phương tiện, hoa hồng — ghi rõ "riêng" hay "mặc định"), thẻ Hoạt động (sẵn sàng/ngoại tuyến, đánh giá, đơn hoàn thành, số dư ví thợ, ngày tạo; 🔁 đã bỏ dòng "Giấy tờ" cùng 3.5), thẻ Tài khoản (tên đăng nhập, tình trạng mật khẩu: tạm / thợ đã tự đặt / chưa có), 3 nút: **Sửa thông tin**, **Đặt lại mật khẩu**, **Khóa / Mở khóa tài khoản**. Không bao giờ hiện `password_hash`/`salt` (API đã loại bỏ, chỉ trả cờ `has_password`).
  - **Khóa / mở**: cửa sổ xác nhận, khóa có ô *Lý do (tùy chọn, ≤ 200 ký tự)*. Khóa → `status='locked'`, `is_online=false`, `locked_at`, `lock_reason`, xóa các dòng `sessions` của thợ đó; đăng nhập đã chặn sẵn `status=locked` từ 2.4. Mở khóa xóa `locked_at`/`lock_reason`. Gọi lại khi đã đúng trạng thái thì không ghi, không audit lặp. Audit `vendor.lock` / `vendor.unlock` (có lý do).
  - **Đặt lại mật khẩu**: sinh mật khẩu tạm mới (như 3.3), băm lại, `must_change_pw=true`, xóa phiên cũ và gỡ khóa "đăng nhập sai 5 lần" của username đó (`__meta`). Cửa sổ kết quả hiện tên đăng nhập + mật khẩu **một lần** (có Sao chép từng dòng / Sao chép thông tin đăng nhập; không đóng được bằng cách chạm nền). Audit `vendor.reset_password` (**không** ghi mật khẩu). Thợ mẫu trong seed chưa có mật khẩu: reset xong đăng nhập được.
  - **Sửa thông tin**: dùng lại form 3.3 (điền sẵn): loại, tên, SĐT, email, số thợ, dịch vụ, khu vực, phương tiện, hoa hồng riêng. **Tên đăng nhập chỉ đọc** (không đổi được), không có ô mật khẩu; không đụng ví, đánh giá, trạng thái. SĐT chỉ kiểm trùng với thợ **khác** (giữ SĐT cũ không báo trùng). Đọc lại hai lần như 3.3. Không đổi gì thì không ghi và báo "Không có thay đổi". Audit `vendor.update` kèm tên các trường đổi và giá trị cũ/mới (riêng SĐT, email chỉ ghi tên trường, **không** ghi giá trị). Thợ mẫu chưa có email: phải điền email mới lưu được (email bắt buộc như 3.3).
  - 🆕 Cửa sổ xác nhận ở màn này là markup riêng (`data-vd-backdrop`) chứ không dùng `C.modal`: theo cách đọc `components.js`, một lần bấm bên trong `C.modal`/`C.sheet` (kể cả vào ô nhập) sẽ đóng cả cửa sổ vì `closest('[data-modal-close]')` gặp lớp nền; chưa sửa `components.js` vì ngoài phạm vi task, cần bạn duyệt nếu muốn sửa.
  - 🆕 **Avatar** (cập nhật sau): thẻ trong danh sách và đầu trang chi tiết **hiện ảnh đại diện (`vendors.avatar_path`) nếu có**, không có hoặc ảnh lỗi thì hiện chữ cái đầu tên. Dùng chung hàm `TTV.screens.admin.avatarHtml(name, src, cls)` (trong `admin.js`; `cls` = `admin-record__avatar` cho thẻ danh sách, `admin-detail-avatar` cho đầu trang chi tiết; có bộ bắt lỗi ảnh ở pha capture để quay về chữ cái đầu). Áp tương tự cho khách ở 8.1.
  - 🆕 Giới hạn của demo: khóa / reset chỉ xóa dòng `sessions` trong DB; phiên đã nằm sẵn trong `sessionStorage` của tab thợ đang mở chỉ bị hủy ở lần tải lại trang (`validateSession` lúc khởi động), vì chưa có polling (5.10).
  *Đã kiểm tra*: chạy thử 35 ca API bằng Node với kho dữ liệu giả (quyền, khóa/mở, reset, sửa, trùng SĐT, audit không lộ SĐT/email/mật khẩu) và dựng HTML 5 màn bằng DOM giả (không còn khóa chữ thiếu, tên có `<b>` được escape); **chưa chạy trên trình duyệt thật**.
- [x] ~~**3.5 Duyệt giấy tờ thợ**~~ 🔁 **ĐÃ BỎ** (đã chốt): không có bước duyệt/xác minh. Admin tạo tài khoản thợ ở 3.3 là **thợ dùng được ngay** (đăng nhập, đổi mật khẩu lần đầu, bật Sẵn sàng, nhận đơn). Không có bảng `vendor_documents`, không có `kyc_status` cho thợ, không có huy hiệu "Đã xác minh", không upload giấy tờ. Giữ số thứ tự để các task khác không bị lệch.
- [x] **3.6 Cấu hình giá và hệ thống**: sửa `services.base_price`, `pricing_config` (4 mức trọng lượng, phí tầng, giảm thang máy, phí km, hệ số tốc độ, số tiền tối thiểu, phút chờ báo giá), `app_settings` (hoa hồng mặc định, bot demo, ngưỡng ví âm, 🆕 hotline, email hỗ trợ, link Zalo, các mức nạp nhanh, phí nạp).
  🆕 *Đã làm* trong `js/screens/admin/settings.js` (mới: `#/admin/settings`, chỉ `SUPER_ADMIN`; module `pricing` ở `admin.js` thêm cờ `own:true`) + `api.getAdminConfig/validateAdminConfig/saveAdminConfig`; chuỗi chữ trong `i18n.js` (khóa `adminCfg.*`). Một màn, **3 tab chip**: *Đơn giá* (giá cơ bản 7 dịch vụ + phí 4 mức trọng lượng), *Phí & tốc độ* (phí/tầng, giảm thang máy %, phí/km, hệ số Nhanh/Gấp, số tiền tối thiểu, phút chờ báo giá), *Hệ thống* (hoa hồng mặc định %, bật bot demo, ngưỡng ví âm, hotline, email hỗ trợ, link Zalo, mức nạp nhanh dạng chip thêm/xóa, phí nạp). Dữ liệu các tab giữ nguyên khi chuyển tab; một nút **Lưu thay đổi** dính đáy, chỉ bật khi có thay đổi; **Hoàn tác** bỏ các sửa chưa lưu.
  - **Quy tắc kiểm tra**: tiền là số nguyên VND (gõ `100.000` hay `100000` đều được); giá cơ bản và phí trọng lượng 0–10.000.000; phí tầng, phí km 0–1.000.000; giảm thang máy 0–100 % (lưu `0,7` cho 70 %); hệ số Mặc định cố định ×1, Nhanh ≥ 1, Gấp ≥ Nhanh, tối đa ×10, 2 chữ số thập phân; số tiền tối thiểu 1.000–10.000.000; phút chờ 1–1440; hoa hồng 0–100 % (≤ 2 chữ số thập phân); ngưỡng ví âm nhập số dương (lưu **âm**, ví dụ nhập 500.000 → `-500000`); hotline 8–15 chữ số; email hợp lệ; link Zalo bắt buộc `https://`; mức nạp nhanh 1–9 mức, mỗi mức 10.000–50.000.000, không trùng, lưu theo thứ tự tăng dần; phí nạp 0–1.000.000.
  - **An toàn ghi**: `saveAdminConfig` kiểm quyền (`SUPER_ADMIN`, nếu không → `FORBIDDEN`), kiểm tra lại toàn bộ ở API (lỗi `VALIDATION` kèm `err.errors` theo từng trường), **đọc lại bản ghi ngay trước khi ghi**, chỉ ghi các bản ghi thật sự đổi (không đổi gì thì không ghi, báo "Không có thay đổi"), rồi ghi `audit_logs` theo nhóm: `settings.service_price.update`, `settings.pricing.update`, `settings.app.update` kèm giá trị cũ/mới (hotline/email/link Zalo là thông tin công khai nên được ghi).
  - 🆕 Chưa có `pricing.js` (task 4.4) nên giá mới có hiệu lực khi 4.4 đọc `pricing_config`/`services`. `pricing_config.quote_window_min` là nguồn duy nhất cho phút chờ báo giá; khóa `app_settings.default_quote_window_min` trong seed **không dùng** (không hiển thị ở màn này). Hệ số `speed_multipliers.default` luôn là 1.
- [x] **3.7 Audit log**: ghi nhật ký mọi thao tác ở 3.2–3.6; màn xem nhật ký.
  🆕 *Đã làm* trong `js/screens/admin/audit-logs.js` (mới: `#/admin/audit-logs`, chỉ `SUPER_ADMIN`; module `audit-logs` ở `admin.js` thêm cờ `own:true`, vào từ **Thêm → Nhật ký hoạt động**) + `api.listAuditLogs` và hằng `api.AUDIT_GROUPS` (cuối `ttv-api.js`); chuỗi chữ trong `i18n.js` (khóa `adminLog.*`). Bảng KIO: `ttv_audit_logs` (chỉ append, màn này **chỉ xem**, không sửa/xóa và không tự ghi audit).
  - **Rà soát phần ghi (3.2–3.6)**: đã đủ, không cần sửa code ghi. `vendor.create` (3.3); `vendor.update`, `vendor.lock`, `vendor.unlock`, `vendor.reset_password` (3.4); `settings.service_price.update`, `settings.pricing.update`, `settings.app.update` (3.6); thêm sẵn `settings.policy.update` (chính sách) và `auth.login`, `auth.logout`, `auth.change_password` (staff). 3.2 đã bỏ nên không có `staff.*`; 3.5 đã bỏ nên không có `vendor.document.*`. Chi tiết không chứa mật khẩu, SĐT, email (chỉ tên trường).
  - **Màn xem**: ô tìm (nhãn hành động, mã hành động, người thực hiện, đối tượng, nội dung chi tiết), chip nhóm *Tất cả / Đăng nhập / Thợ / Cấu hình* (kèm số lượng; nhóm theo tiền tố `auth.` `vendor.` `settings.`), chip thời gian *Mọi lúc / Hôm nay / 7 ngày / 30 ngày*, nút **Làm mới**, phân trang 10 dòng, mới nhất trước. Mỗi dòng: biểu tượng nhóm, nhãn hành động tiếng Việt, người thực hiện · giờ, nhãn nhóm + `@username`/đối tượng. Bấm dòng mở cửa sổ **Chi tiết thao tác** (hành động + mã, người thực hiện + vai trò + id, giờ có giây, bảng đối tượng, các trường chi tiết; thay đổi hiện dạng `cũ → mới`). Có trạng thái đang tải / rỗng / không có kết quả / lỗi (nút Thử lại). Hành động chưa có nhãn thì hiện mã gốc.
  - **An toàn đọc**: `listAuditLogs` kiểm quyền (`SUPER_ADMIN`, nếu không → `FORBIDDEN`), tra tên người thực hiện từ `staff`/`vendors`, tự gọi `Store.invalidate(['audit_logs'])` để thấy dòng mới ngay (KIO cache 30 giây), và **loại mọi khóa có chữ `pass/salt/hash/otp/token/secret`** khỏi `detail` dù dữ liệu cũ có lỡ ghi. Nội dung chuỗi được escape khi hiển thị.
  - 🆕 Quy ước cho task sau: mọi thao tác admin mới (giai đoạn 8: khách, đơn, rút tiền, nội dung…) phải ghi qua `TTV.Utils.audit('<nhóm>.<hành động>', { target_table, target_id, detail })`; **thêm nhãn** `adminLog.act.<mã hành động>` (và `adminLog.f.<trường>` nếu có trường mới) vào `i18n.js`, và nếu có nhóm mới thì thêm vào `api.AUDIT_GROUPS` + `adminLog.filter.<nhóm>` / `adminLog.group.<nhóm>`.
  *Đã kiểm tra*: chạy thử bằng Node + jsdom với kho dữ liệu giả (API: sắp xếp, tên người thực hiện, lọc khóa nhạy cảm, chặn `VENDOR`; màn: lọc nhóm / thời gian, tìm kiếm, phân trang, cửa sổ chi tiết, escape, làm mới, trạng thái lỗi và rỗng); **chưa chạy trên trình duyệt thật / KIO thật**.
- [x] **3.8 Dashboard khung**: các thẻ số liệu, dữ liệu thật sẽ nối thêm ở giai đoạn 8.
  🆕 *Đã làm* trong `js/screens/admin/dashboard.js` (mới, nạp **trước** `admin.js`; `#/admin` và `#/admin/dashboard`, chỉ `SUPER_ADMIN`) + sửa `admin.js` (hàm `dashboard()` ủy quyền cho `TTV.screens.adminDashboard.render`, route dashboard thêm `destroy`); chuỗi chữ khóa `adminDash.*` trong `i18n.js`; CSS cuối `style.css` (khối "3.8"). Vẫn trong khung mobile 430px, không sidebar. Bố cục: lời chào → chip khoảng thời gian (*Hôm nay / 7 ngày / 30 ngày*) → **8 thẻ số liệu** (Đơn hôm nay, Đơn đang xử lý, GMV, Hoa hồng, Khách mới, Thợ đang sẵn sàng, Tỉ lệ ghép thành công, Đơn không tìm được thợ; bấm thẻ → màn module tương ứng) → **Cần xử lý** (Yêu cầu rút tiền, Giao dịch nạp đang xử lý, Báo cáo mới, kèm số đếm) → **biểu đồ khung** *Số đơn* với công tắc Ngày/Tuần (7 cột rỗng) → Truy cập nhanh → Hoạt động gần đây (rỗng). Có đủ trạng thái: **đang tải** (khối xám nhấp nháy), **lỗi** (nút Thử lại), **rỗng** (giá trị "—" + ghi chú "sẽ nối ở 8.8").
  - 🆕 **Cách nối dữ liệu thật ở 8.8 (không phải sửa `dashboard.js`)**: định nghĩa `TTV.api.getAdminDashboard(range)` (`range` = `today|7d|30d`) trả Promise một object theo khóa `id` của thẻ: `orders_today`, `orders_active`, `gmv`, `commission`, `new_customers`, `vendors_online`, `match_rate` (số 0–1), `orders_unmatched`, `withdrawals_pending`, `topups_pending`, `reports_new`; biểu đồ lấy từ `series_day` / `series_week` (mảng số). Khóa thiếu → hiện "—". API phải tự kiểm quyền `SUPER_ADMIN` như các hàm admin khác. Hiện **chưa có** hàm này nên mọi thẻ là "—".
  - *Đã kiểm tra*: chạy thử bằng Node với DOM giả (đang tải → sẵn sàng với "—" ×8 + ghi chú; có dữ liệu giả hiển thị đúng số/tiền/phần trăm; Promise lỗi → khối lỗi có Thử lại; tên admin có thẻ HTML được escape; không còn khóa chữ thiếu); `node --check` cả 3 file JS. **Chưa chạy trên trình duyệt thật / KIO thật.**

**Demo cuối giai đoạn 3**: admin tạo được thợ, thợ đăng nhập được bằng tài khoản vừa tạo, chỉnh giá có hiệu lực, audit log ghi đủ.

### Giai đoạn 4 — Địa chỉ và Đặt đơn (khách)

- [x] **4.1 Trang chủ khách**: 🆕 header xanh có lời chào theo giờ + chuông thông báo (🆕 chấm đỏ khi có thông báo chưa đọc); thẻ nổi gồm "Điểm bốc hàng…" (bấm → mở form đặt đơn) và "Bốc vác đến?" kèm nút **Dán** (đều mở form đặt đơn; 🆕 Dán = dán địa chỉ từ clipboard vào ô điểm trả); 7 ô dịch vụ (mở form với dịch vụ đã chọn); 🆕 carousel banner có chấm phân trang (thẻ ưu đãi hội viên, khuyến mãi → Mã giảm giá); "Khám phá thêm" (🆕 thẻ ảnh cuộn ngang, không click); nút Zalo nổi (🆕 mở `zalo.me`); bottom tab.
  *Xong khi*: bấm từng nút/ô mở đúng route, dịch vụ được truyền sang form.
- [x] **4.2 Sổ địa chỉ**: 🆕 mô tả "Quản lý các địa chỉ bốc và địa chỉ đổ", ô tìm kiếm, danh sách thẻ (tên gợi nhớ, nhãn loại, nhãn **Mặc định**, địa chỉ chi tiết, người liên hệ + SĐT, nút Sửa / Xóa), trạng thái rỗng, nút "+ Thêm địa chỉ mới" dính đáy. Màn **Thêm/Sửa địa chỉ**: nút "Chọn trên bản đồ", tên gợi nhớ, địa chỉ chi tiết (🆕 bộ đếm ký tự /250), người liên hệ, SĐT, 4 chip loại (Nhà / Văn phòng / Kho / Khác), công tắc "Đặt làm địa chỉ mặc định" (🆕 phụ đề "Địa chỉ mặc định sẽ được ưu tiên khi tạo đơn hàng"), nút "Lưu địa chỉ" → về Sổ địa chỉ. Chỉ có 1 địa chỉ mặc định.
- [ ] **4.3 `map-service.js`**: Leaflet + OSM, tìm địa chỉ Nominatim, chọn điểm trên bản đồ, tính khoảng cách.
- [ ] **🆕 4.3b Modal "Chọn điểm bốc hàng / trả hàng"** (dùng chung cho form đặt đơn và form địa chỉ): bottom sheet gần toàn màn hình, ô tìm kiếm (gợi ý Nominatim), bản đồ có ghim, nút zoom +/−, nút "Vị trí của tôi", hiển thị địa chỉ đã chọn bên dưới, nút "Xác nhận địa điểm". Có thêm danh sách **địa chỉ đã lưu** để chọn nhanh và liên kết "+ Thêm" mở màn Thêm địa chỉ.
  *Xong khi*: chọn được điểm bằng tìm kiếm, bằng kéo ghim, bằng địa chỉ đã lưu; trả về `{addr, lat, lng}`.
- [ ] **4.4 `pricing.js`**: hàm tính giá theo mục 4, có unit test chạy bằng trang test đơn giản (`#/sim/pricing-test`).
  *Xong khi*: ≥ 8 ca test (thang máy, tầng, tốc độ, ≥ 2 thợ, mã giảm giá) cho kết quả đúng. 🆕 Trong đó có ca mẫu: Chuyển nhà, Vừa, bốc 2 tầng có thang máy, dỡ 2 tầng không thang máy, 1,38 km → 50.000 / 100.000 / 39.000 / 6.900 (phí trọng lượng tạm 100.000đ). Thêm ca: `final_price` ≤ `user_offer` và hoàn đúng phần chênh lệch.
- [ ] **4.5 Form đặt đơn — phần địa điểm và dịch vụ**: điểm bốc/trả (mở modal 4.3b), **Hoán đổi**, chip khoảng cách, "+ Thêm điểm trả (sắp có)" khóa, dòng **Dịch vụ: {tên} — Đổi** (mở sheet chọn 1 trong 7 dịch vụ, có mô tả). Nút đáy "Chọn điểm bốc & điểm trả" → "Đặt đơn".
- [ ] **4.6 Form đặt đơn — phần chi tiết hàng**: trọng lượng 4 mức (chip + dòng mô tả bên dưới), khối Nơi bốc (số tầng + thang máy), công tắc dỡ hàng → khối Nơi dỡ (số tầng + thang máy), số thợ 1–10, ghi chú cho thợ.
- [ ] **4.7 Form đặt đơn — phần tùy chọn**: Đặt ngay / Đặt lịch (🆕 khóa "Sắp có"), 🆕 bottom sheet Tốc độ nhận đơn + Loại nhà cung cấp (ràng buộc theo số thợ), thẻ "Số tiền bạn trả" ≥ 10.000đ, 4 dòng giá tự tính, chọn Tiền mặt / Ví (🆕 hiện số dư ví; ví không đủ → chặn + gợi ý Nạp tiền + cho đổi sang tiền mặt, xem mục 4).
- [x] **4.8 Form đặt đơn — media**: ảnh ≤ 7 (đếm n/7), video ≤ 2 phút (🆕 hiện `mm:ss`, nút Quay lại / Xóa), xem trước, xóa, 🆕 báo lỗi ảnh tải thất bại. *Đã làm*: `js/ui/order-media.js` chọn file + kiểm tra ≤ 2 phút; form hiện poster, `mm:ss`, **Quay lại** / **Xóa**; ảnh lỗi dòng đỏ; ghi `uploads/` nếu đã chọn thư mục. Desktop = chọn file video.
- [x] **4.9 Modal xác nhận đặt đơn**: 🆕 bottom sheet (lộ trình + khoảng cách, phương thức, số tiền, dòng "Thanh toán được thu trước khi ghép thợ" (🆕 ✅ **chỉ hiện khi chọn trả bằng Ví**; tiền mặt thì không hiện), nút Hủy / Thanh toán), tạm giữ tiền ví (nếu trả ví), tạo `orders` trạng thái `finding` + `order_events` + 🆕 thông báo "Đơn hàng đã được tạo!"; sau đó chuyển tới `#/orders/:id/quotes` (🆕 khung tối thiểu: đếm ngược, lộ trình, trạng thái rỗng, nút Hủy đơn; phần còn lại làm ở 5.6).

**Demo cuối giai đoạn 4**: khách đặt được một đơn đầy đủ, đơn xuất hiện trong DB với giá và media đúng.

### Giai đoạn 5 — Khu thợ (Vendor)

- [x] **5.1 Khung app thợ**: bottom tab, trang chủ với công tắc **Sẵn sàng nhận đơn**, thống kê hôm nay. *Đã làm* trong `js/screens/vendor.js` + `api.getVendorSelf/setVendorOnline/getVendorDashboard` (cuối `ttv-api.js`) + khóa i18n `vendor.*` + CSS `.vendor-*`; đã gỡ màn tạm `#/vendor` khỏi `staff-auth.js`. Route: `#/vendor` (Trang chủ), `#/vendor/market` (Chợ đơn), `#/vendor/jobs` (Việc của tôi), `#/vendor/profile` (Cá nhân); bottom tab 4 mục cùng khung mobile như khu khách. **Trang chủ**: hero (lời chào theo giờ, tên, loại nhà cung cấp + số thợ, ★ đánh giá + số đơn đã làm); thẻ công tắc **Sẵn sàng nhận đơn** ghi `vendors.is_online` (đọc lại hồ sơ ngay trước khi ghi; tài khoản bị khóa giữa chừng → đăng xuất; ví thấp hơn `vendor_wallet_negative_limit` (−500.000đ) → khóa công tắc + khung cảnh báo vàng); **Thống kê hôm nay** (Việc hoàn thành, Thu nhập = tổng `vendor_earning` của đơn `completed` trong ngày); **Đang diễn ra** (Báo giá chờ chọn = báo giá `pending` của đơn còn `finding`; Việc đang làm = đơn `matched/arriving/working`, bấm → Việc của tôi); nút **Xem chợ đơn**. **Chợ đơn / Việc của tôi**: khung + trạng thái "sắp có" (làm ở 5.2, 5.8). **Cá nhân**: hero + menu Báo giá của tôi / Ví của tôi / Rút tiền / Đánh giá / Hồ sơ thợ (hiện "Sắp có" tới khi route tồn tại, tự mở khi task sau đăng ký route đó, không phải sửa `vendor.js`; hiện `/vendor/quotes`, `/vendor/wallet`, `/vendor/withdrawals`, `/vendor/reviews`, `/vendor/info`), Đổi mật khẩu (→ `#/change-password`), Đăng xuất có hộp xác nhận. 🆕 **Ghi chú cho task sau**: (1) 5.2 và 5.8 gắn màn vào tab bằng `TTV.screens.vendor.register('market' | 'jobs', { render(box, ctx), destroy() })`, **không** `Router.add` trùng `/vendor/market`, `/vendor/jobs`; (2) 5.8 khi hoàn thành đơn phải ghi `completed_at` (hoặc mốc `completed` trong `timeline[]`) và `vendor_earning` thì thống kê hôm nay mới đúng; (3) DB **không** tự tắt `is_online` khi ví âm quá ngưỡng, nên 5.2/5.9 khi lọc thợ nhận đơn phải xét cả `is_online` lẫn ví chưa âm quá ngưỡng (`getVendorDashboard().readiness.online` là cách tính cho chính thợ đó); (4) polling tự làm mới Trang chủ làm ở 5.10 (hiện chỉ tải lại khi vào màn).
- [x] **5.2 Chợ đơn**: danh sách đơn `finding`, lọc tự động theo loại/số thợ/dịch vụ/khu vực, sắp xếp mới nhất/gấp nhất/gần nhất.
  🆕 *Đã làm* trong `js/screens/vendor-market.js` (gắn vào tab bằng `TTV.screens.vendor.register('market', …)`, không đụng `vendor.js`) + `api.listMarketOrders/sortMarketOrders/currentOffer` (cuối `ttv-api.js`); chuỗi chữ khóa `vendorMarket.*`; CSS `.vm-*`. **Bộ lọc** (đúng mục 4 "Báo giá (thợ)"): đơn `finding` còn hạn (`quote_deadline`, hoặc `created_at` + `quote_window_min`) và: loại nhà cung cấp của đơn = `any` hoặc trùng loại thợ; số thợ của đơn ≤ `team_size`; đơn ≥ 2 thợ không cho thợ cá nhân; dịch vụ nằm trong `vendors.services`; khu vực: "Toàn TP.HCM" khớp mọi đơn, còn lại so **điểm bốc** với tên quận/huyện (bỏ dấu, "Quận 1" không nhầm "Quận 10/12", nhận "Q.12"). Thợ **đang tắt Sẵn sàng nhận đơn hoặc ví âm quá ngưỡng** thì chợ đơn không liệt kê đơn nào (hiện hướng dẫn / cảnh báo khóa). **Sắp xếp** (chip, giữ lựa chọn khi quay lại): *Mới nhất* (`created_at`), *Gấp nhất* (Gấp → Nhanh → còn lại, hòa thì mới nhất), *Gần nhất* (quãng đường điểm bốc → điểm trả ngắn nhất). Thẻ đơn: icon + tên dịch vụ đúng dịch vụ đã chọn, mã `#XXXXXXXX`, "x phút trước", nhãn Gấp/Nhanh, 2 địa chỉ, chip km / trọng lượng / số thợ, "Khách trả tối đa", "Còn n phút", nhãn "Đã báo giá" nếu thợ đã có báo giá; bấm → `#/vendor/market/:id`. Có trạng thái đang tải / rỗng / tắt nhận đơn / ví khóa / lỗi (Thử lại) và nút Làm mới; **chưa tự cập nhật** (polling làm ở 5.10).
  🆕 *Dữ liệu thử*: task 4.9 chưa tạo đơn thật nên thêm `js/api/demo-orders.js` + trang `#/sim/demo-orders` (nút **Tạo đơn mẫu** / **Xóa đơn mẫu**, 8 đơn có cờ `demo:true` gồm đơn quá hạn, đơn đã ghép, đơn Gấp, đơn 3 thợ, đơn chỉ Công ty…). Gỡ file này khi 5.9 làm panel `#/sim` chính thức.
  *Đã kiểm tra*: 28 ca API bằng Node với kho dữ liệu giả (lọc từng điều kiện, 3 kiểu sắp xếp, tắt nhận đơn, ví khóa, khóa quyền khách) và dựng DOM bằng jsdom (chợ đơn, chi tiết, không tìm thấy, tắt nhận đơn; tên/địa chỉ có thẻ HTML được escape); **chưa chạy trên trình duyệt thật**.
- [x] **5.3 Chi tiết đơn (thợ)**: lộ trình, khoảng cách, thông tin việc, ảnh, video, số tiền khách trả (mức Gấp hiển thị giá hiện tại).
  🆕 *Đã làm* trong `js/screens/vendor-order.js` (route `#/vendor/market/:id`, chỉ `VENDOR`) + `api.getMarketOrder`; chuỗi khóa `vendorOrder.*`; CSS `.vo-*`. Màn full-screen có header ‹ (không bottom tab) gồm: thẻ đầu (dịch vụ, mã đơn, "Tạo x phút trước", nhãn Gấp/Nhanh + trạng thái), thẻ **Khách trả tối đa** (= `user_offer`; **đơn Gấp hiện giá hiện tại** qua `api.currentOffer`, 🔁 ghi chú chung "báo giá tối đa bằng số tiền này, khách chọn trong các báo giá, rút được khi chưa được chọn" + với đơn ≥ 2 thợ thêm dòng điều kiện "chỉ tổ đội/công ty có từ n thợ trở lên", hạn nhận báo giá còn n phút, báo giá của chính thợ nếu có, 4 dòng giá tham khảo khi đơn có `price_breakdown`), **Lộ trình** (điểm bốc, điểm trả, khoảng cách làm tròn 1 chữ số "3,2 km"), **Thông tin công việc** (dịch vụ, trọng lượng + mô tả, tầng bốc + thang máy, cần dỡ hàng → tầng dỡ + thang máy, số thợ, tốc độ, loại nhà cung cấp, thanh toán, ghi chú), **Ảnh & video hiện trạng** (lưới ảnh bấm để phóng to, ảnh lỗi hiện chữ "Không tải được", video có điều khiển + `mm:ss`), **Khách hàng**. 🆕 **Thẻ Khách hàng (đã sửa)**: **luôn hiện tên khách** (avatar tròn 48px nền xanh nhạt, chữ cái đầu căn giữa — CSS `.vo-customer>.avatar`, vì `.avatar` chưa có style nền toàn cục và bị luật `.vo-customer span` ghi đè nếu không có — + tên) cho mọi thợ xem được đơn; **SĐT và nút Gọi khách chỉ hiện khi đơn là của chính thợ và đã ghép** (`matched` trở đi), trước đó hiện dòng "SĐT khách chỉ hiện sau khi bạn được ghép đơn" kèm biểu tượng khóa. `api.getMarketOrder` trả `view.customer = { name, phone }` với `phone = null` khi chưa ghép (SĐT không rời khỏi API). **Quyền xem** (API kiểm lại): đơn của chính thợ, đơn thợ đã báo giá, hoặc đơn `finding` còn hạn **và** khớp hồ sơ; lỗi `ORDER_NOT_FOUND` / `UNAVAILABLE` (hết hạn hoặc đã ghép) / `NOT_ELIGIBLE` có màn riêng. **SĐT khách chỉ hiện khi đơn là của thợ và đã `matched` trở đi** (xem thẻ Khách hàng ở trên).
  🆕 **Ghi chú cho 5.4** (🔁 đã gộp 5.4 + 5.5): (1) ô đáy màn gắn nút bằng `TTV.screens.vendorOrder.registerActions(function (slot, view, reload) { …; return true; })` (trả `true` khi có vẽ nút → ô đáy mới hiện; `reload()` tải lại chi tiết sau khi ghi); (2) `view.action` = `'quote'` (mọi đơn, kể cả ≥ 2 thợ; 🔁 không còn giá trị `'accept'`) / `null` (không được thao tác: thợ đang tắt nhận đơn, ví khóa, đơn hết hạn, **hoặc không đủ điều kiện số thợ**), `view.my_quote` = báo giá hiện hành của thợ; `view.mode` đã bỏ; (3) 5.4 vẫn phải đọc lại trạng thái đơn ngay trước khi ghi.
  🆕 *Sửa sau khi gộp quy trình (task 5.3 cập nhật)*: `vendor-order.js` + `api.getMarketOrder` hiện tên khách luôn, ẩn SĐT tới khi ghép; bỏ nhánh "giá cố định" (`view.mode`) và `view.action = 'accept'`; chuỗi `vendorOrder.mode.*` thay bằng `vendorOrder.mode.bid` (chung) + `vendorOrder.mode.team` (điều kiện số thợ), thêm `vendorOrder.customer.phoneHidden`.
- [x] **5.4 Báo giá (mọi đơn, 🔁 đã gộp 5.4 cũ "đơn 1 thợ" + 5.5 cũ "đơn ≥ 2 thợ")**: một màn/luồng duy nhất cho cả đơn 1 thợ lẫn đơn ≥ 2 thợ, gắn vào ô đáy của Chi tiết đơn (5.3) bằng `registerActions`. Thợ **nhập giá (≤ số tiền khách đặt, ≥ số tiền tối thiểu)**, ETA (phút), lời nhắn → **Gửi báo giá**; sau đó **chờ khách chọn** trong số nhiều báo giá của các thợ/tổ đội/công ty khác nhau; **sửa hoặc rút báo giá được khi chưa được chọn** (khi `accepted` thì khóa nút). Mỗi nhà cung cấp 1 báo giá hiệu lực/đơn (báo lại = cập nhật `updated_at`, rút = `status='withdrawn'` + `withdrawn_at`, rút xong báo lại được nếu đơn còn hạn).
  - 🆕 **Sửa lỗi ô nhập tiền/ETA khi gõ bằng bộ gõ tiếng Việt của Windows** (gõ 45000 ra 445000): bộ gõ đưa từng phím vào vùng "đang soạn" (composition), mà code cũ ghi đè `value` mỗi lần `input` nên ký tự đang soạn bị chèn lại. `vendor-quote.js` thêm `bindDigits`: không đụng `value` khi đang soạn (`compositionstart/end`, `isComposing`), chỉ định dạng khi kết thúc, chỉ ghi khi giá trị đổi và giữ vị trí con trỏ (chèn giữa dãy số không còn nhảy con trỏ về cuối). Áp cho cả ô số tiền và ô ETA. Đã mô phỏng IME bằng CDP trên Chromium (bản cũ ra sai, bản mới đúng) — chưa thử trên máy Windows thật. Cần dùng `bindDigits` cho mọi ô nhập số có định dạng sau này.
  - **Điều kiện nhận đơn** (kiểm ở cả giao diện lẫn API, xem mục 4 "Loại đơn"): thợ **cá nhân** chỉ báo giá đơn **1 thợ**; **tổ đội/công ty** chỉ báo giá khi `team_size` ≥ `workers` của đơn; cộng thêm loại nhà cung cấp, dịch vụ, khu vực, đang bật Sẵn sàng, ví chưa âm quá ngưỡng. Không đủ điều kiện → `view.action = null`, màn hiện lý do (ví dụ "Đơn cần 3 thợ, đội bạn chỉ có 2"; "Thợ cá nhân không nhận đơn từ 2 thợ").
  - **Quy tắc ghi** (`api.submitQuote` / `api.withdrawQuote`, ghi `quotes` + `order_events` `quoted`): kiểm quyền `VENDOR`; **đọc lại đơn ngay trước khi ghi** (còn `finding`, còn hạn, vẫn khớp điều kiện); giá nguyên VND, `10.000đ ≤ giá ≤ user_offer`; sửa/rút chỉ khi báo giá còn `pending`; đơn đã `matched` thì từ chối kèm thông báo "Đơn đã được ghép thợ khác".
  - **Giá không phụ thuộc loại đơn**: đơn ≥ 2 thợ **không còn giá cố định** (không tự điền giá, không khóa ô giá).
  🆕 *Đã làm* trong `js/screens/vendor-quote.js` (mới, nạp sau `vendor-order.js`, gắn vào ô đáy 5.3 bằng `registerActions`) + `api.submitQuote/withdrawQuote` (cuối `ttv-api.js`, trước `saveOrderMedia`); chuỗi khóa `vendorQuote.*`; CSS `.vq-*`. **Ô đáy** theo trạng thái: chưa báo → nút **Báo giá** + dòng "Giá báo tối đa X"; đã báo (chờ chọn) → thanh giá + ETA + lời nhắn + nút **Rút báo giá** / **Sửa**; không báo được → khung vàng nêu lý do (tắt Sẵn sàng, ví khóa, hết hạn, đã ghép, không đủ điều kiện số thợ); đơn không còn `finding` → không vẽ gì (việc của 5.8). **Form** là bottom sheet: giá (tự định dạng `100.000`, nút "Dùng mức tối đa"), ETA (1–240 phút, chip 15/30/45/60), lời nhắn ≤ 200 ký tự có đếm; lỗi hiện ngay dưới từng ô. **Rút** có sheet xác nhận. **API**: `submitQuote({order_id, price, eta_min, message})` dùng cho cả gửi mới, sửa và báo lại sau khi rút; kiểm quyền `VENDOR`, đọc lại đơn/hồ sơ/báo giá ngay trước khi ghi; mã lỗi `ORDER_TAKEN` (đã ghép/không còn `finding`), `UNAVAILABLE` (hết hạn), `NOT_ELIGIBLE` (kèm lý do cụ thể: "Thợ cá nhân không nhận đơn từ 2 thợ trở lên" / "Đơn cần N thợ, đội của bạn chỉ có M"…), `OFFLINE`, `WALLET_LOCKED`, `QUOTE_LOCKED` (đã `accepted`), `VALIDATION` (+ `err.errors` theo `price`/`eta_min`/`message`). Giá nguyên VND, `min_amount` ≤ giá ≤ `api.currentOffer(order)` (bằng `user_offer`, đơn Gấp thì là giá hiện tại). Mỗi thợ **1 dòng `quotes` cho mỗi đơn**: sửa = cập nhật tại chỗ; rút = `status='withdrawn'` + `withdrawn_at`; báo lại = dùng lại dòng đó (`pending`, `created_at` mới). Ghi `order_events` (`quoted`, ghi chú Báo giá / Sửa báo giá / Rút báo giá) và gửi thông báo "Có báo giá mới" cho khách khi là báo giá mới. `api.getMarketOrder` trả thêm `view.min_amount`, `view.block_reason` (`offline|wallet|expired|taken|not_fit`), `view.fit_message`, và `my_quote` có `eta_min`, `message`. Sửa kèm: nhãn "Đã báo giá" ở Chợ đơn (5.2) chỉ hiện khi báo giá còn `pending` (đã rút thì không). *Chưa làm*: khách chưa thấy báo giá (5.6), "Báo giá của tôi" (5.7), cập nhật tự động (5.10). *Đã kiểm tra*: 16 ca API bằng Node với kho giả (gửi/sửa/rút/báo lại, giá trên/dưới giới hạn, ETA sai, cá nhân + đơn 3 thợ, đội 2 thợ + đơn 3 thợ, đơn đã ghép, rút khi đã được chọn, khách gọi API) và dựng markup ô đáy 7 trạng thái; **chưa chạy trên trình duyệt thật**.
  *Xong khi*: đơn 1 thợ và đơn 3 thợ đều báo giá/sửa/rút được; thợ cá nhân không thấy/không báo giá được đơn 2 thợ; đội 2 thợ không báo giá được đơn 3 thợ; đội 5 thợ báo giá được đơn 3 thợ.
- [x] ~~**5.5 Nhận đơn (đơn ≥ 2 thợ)**~~ 🔁 **ĐÃ GỘP vào 5.4** (cùng quy trình báo giá, chỉ khác điều kiện nhận đơn theo số thợ). Giữ số thứ tự để các task khác không bị lệch.
- [x] **5.6 Màn "Đang nhận báo giá" (khách)**: 🆕 thẻ "Còn lại để nhận báo giá" + đồng hồ `mm:ss` đếm ngược từ 30 phút, lộ trình 2 điểm, tiêu đề "Báo giá (n) — thấp đến cao", danh sách báo giá (🔁 **dùng chung cho đơn 1 thợ và ≥ 2 thợ**: tên thợ/tổ đội/công ty, nhãn loại, đánh giá, ETA, lời nhắn, giá; 🔁 bỏ nhãn "Vượt mức tối đa" và nút Chấp nhận / Không vì báo giá luôn ≤ mức tối đa), 🆕 **khách tự chọn thợ mong muốn**; xử lý `accepted/rejected`, đơn → `matched`, hết hạn thì tự hủy; nút "Hủy đơn" đáy màn.
  🆕 *Đã làm* trong `js/screens/quotes.js` (mở rộng khung 4.9) + `api.listOrderQuotes/chooseQuote` (cuối `ttv-api.js`); chuỗi khóa `quotes.*`; CSS `.qc-*`. **Danh sách**: tiêu đề "Báo giá (n) — thấp đến cao"; mỗi thẻ có avatar chữ cái, tên thợ/tổ đội/công ty, nhãn loại (+ số thợ), ★ đánh giá (hoặc "Chưa có đánh giá") + số đơn đã làm, "Đến sau n phút" + thời điểm gửi/sửa, lời nhắn, giá lớn kèm "Thấp hơn mức bạn đặt x", nhãn **Giá thấp nhất** (khi có ≥ 2 báo giá) và nút **Chọn**; chưa có báo giá thì giữ khối rỗng "Chưa có báo giá nào — đang chờ…". Dùng chung cho đơn 1 thợ và ≥ 2 thợ. **Chọn thợ**: hộp xác nhận "Chọn {tên}? Bạn sẽ trả {giá}…" → `chooseQuote`: đọc lại đơn + báo giá ngay trước khi ghi (đơn còn `finding`, báo giá còn `pending`, thợ chưa bị khóa), báo giá → `accepted`, các báo giá `pending` còn lại → `rejected`, đơn → `matched` (`vendor_id`, `accepted_quote_id`, `final_price` = giá báo giá, `matched_at`, mốc timeline `matched`), ghi `order_events` `matched`, thông báo cho thợ được chọn ("Bạn đã được chọn") và các thợ không được chọn. Báo giá bị thợ rút/sửa đúng lúc → báo "Thợ vừa rút hoặc sửa báo giá" và tải lại danh sách. **Đơn đã ghép**: màn đổi sang "Đã ghép thợ" hiện thợ được chọn, "Tổng tiền" = `final_price`, nút `Gọi {SĐT}` (khách **chỉ thấy SĐT thợ sau khi chọn**; API không trả SĐT ở báo giá chưa chọn) và nút **Xem đơn hàng** (→ `#/orders`, màn Chi tiết đơn làm ở 6.2). **Tự cập nhật mỗi 4 giây** (bỏ qua khi đang chọn/đang hủy, chỉ vẽ lại danh sách khi có thay đổi, dọn timer khi rời màn) — phần polling của màn khách đã có sẵn ở đây, 5.10 còn lại các màn thợ và màn khách khác. Hết hạn / hủy: các báo giá `pending` của đơn → `expired` (`cancelFindingRow`), để 5.7 hiện ở tab Hết hạn. 🔁 Không còn nhãn "Vượt mức tối đa"/Chấp nhận/Không (đã bỏ khi gộp quy trình). *Chưa nối*: hoàn tiền ví phần chênh `user_offer − final_price` (task 7.3; hiện đơn mới chỉ trả tiền mặt). *Đã kiểm tra*: ca API bằng Node với kho giả (xếp thấp→cao, SĐT ẩn/hiện, chọn thợ, từ chối báo giá còn lại, chọn lần 2, khách khác, hủy đơn → báo giá `expired`) và dựng markup 3 trạng thái (có báo giá, rỗng, đã ghép; tên có thẻ HTML được escape); **chưa chạy trên trình duyệt thật**.
- [x] **5.7 Báo giá của tôi (thợ)**: 4 tab Chờ chọn / Được chọn / Không được chọn / Hết hạn. 🔁 Gồm báo giá của mọi đơn (1 thợ lẫn ≥ 2 thợ, cùng một danh sách). 🔁 **Báo giá đã rút bị ẩn hẳn** (không hiện ở tab nào, không tính vào số đếm tab; đã chốt, thay cho "xếp vào Hết hạn").
  🆕 *Đã làm* trong `js/screens/vendor-quotes.js` (mới: `#/vendor/quotes`, chỉ `VENDOR`; mở từ **Cá nhân → Báo giá của tôi**, mục tự sáng lên vì route đã đăng ký) + `api.listMyQuotes` (cuối khối thợ trong `ttv-api.js`, ngay sau `listVendorHistory`); chuỗi chữ khóa `vendorQuotes.*`; CSS `.mq-*` (khối "5.7" cuối `style.css`; **không** dùng tiền tố `.vq-*` vì đã là của form báo giá 5.4). Khung mobile, header ‹ (không bottom tab), bám mẫu `vendor-history.js` và dùng lại thẻ `.vm-card` của Chợ đơn.
  - **4 tab** (chip cuộn ngang, kèm số lượng): *Chờ chọn* = báo giá `pending` mà đơn còn `finding` và còn hạn; *Được chọn* = `accepted`; *Không được chọn* = `rejected`; *Hết hạn* = `expired` (🔁 báo giá đã rút `withdrawn` **không còn xuất hiện** ở màn này; `api.listMyQuotes` lọc bỏ đơn mà báo giá mới nhất của thợ là `withdrawn`, nên thợ báo lại — dòng quay về `pending` — thì hiện lại bình thường; nhãn "Đã rút" và dòng "Rút x trước" đã gỡ khỏi `vendor-quotes.js`/`i18n.js`; các màn khác như admin 8.2 vẫn hiện báo giá đã rút cho admin). Tab đang xem được giữ khi quay lại từ Chi tiết đơn. Mỗi tab có dòng gợi ý ngắn; mỗi đơn chỉ 1 thẻ (mỗi thợ 1 báo giá/đơn; nếu lỡ có nhiều dòng lấy dòng mới nhất). Sắp xếp theo hoạt động mới nhất (`updated_at`); 10 thẻ/lần + nút *Xem thêm*; nút *Làm mới* (đọc lại bỏ qua cache KIO 30 giây).
  - **Xếp nhóm theo trạng thái thật của đơn** (phòng khi dữ liệu chưa kịp đóng, vì chưa có 6.6 tự hủy): báo giá `pending` nhưng đơn đã **hủy** / **quá hạn** / **không còn tồn tại** → tab *Hết hạn*; `pending` nhưng đơn đã ghép thợ khác → *Không được chọn*; đơn đã ghép đúng thợ này (hoặc `accepted_quote_id` trùng) → *Được chọn*.
  - **Thẻ**: icon + tên dịch vụ đúng dịch vụ đơn, mã `#XXXXXXXX` · "Gửi x trước", nhãn trạng thái, 2 địa chỉ, chip km / số thợ / ETA, lời nhắn (đã escape), **"Giá bạn báo"** lớn + "Khách trả tối đa …" (đơn Gấp dùng `api.currentOffer`), ghi chú phải chân thẻ (Chờ chọn: "Còn n phút"; Được chọn: trạng thái đơn như "Đã ghép thợ"; Không được chọn: "Khách đã chọn thợ khác"; Hết hạn: "Đã rút …" / "Đơn đã hủy" / "Đơn không còn tồn tại" / "Hết hạn").
  - **Bấm thẻ**: *Chờ chọn* và *Được chọn* mở `#/vendor/market/:id` (Chi tiết đơn 5.3: ở đó sửa/rút báo giá bằng 5.4, hoặc xem việc của mình). Hai tab còn lại **chỉ xem, không bấm được** vì `getMarketOrder` từ chối thợ không phải chủ đơn khi đơn đã ghép thợ khác/hủy/hết hạn (sẽ chỉ báo lỗi).
  - **An toàn đọc**: `listMyQuotes` kiểm quyền (`VENDOR`, nếu không → `FORBIDDEN`), chỉ trả báo giá của đúng thợ đang đăng nhập; không trả SĐT khách; có trạng thái đang tải / rỗng (theo từng tab) / lỗi (Thử lại); tài khoản bị khóa → đăng xuất như các màn thợ khác. **Chưa tự cập nhật** (polling làm ở 5.10).
  - *Đã kiểm tra*: Chromium thật (Playwright, `?driver=local`, khung 430px) — 8 báo giá mẫu đủ 4 nhóm (gồm đơn hủy, quá hạn, đã rút, expired, đơn mất, báo giá thợ khác không lẫn vào, lời nhắn có thẻ HTML), đếm tab, thẻ bấm/không bấm, bấm vào chi tiết rồi Back giữ tab, trạng thái rỗng, khách gọi API → `FORBIDDEN`, không tràn ngang, không lỗi JS. **Chưa chạy trên KIO thật** (môi trường thử không có mạng tới `kio.dvqt.vn`) — code chỉ dùng `Store.query/get` như các màn khác nên cần bạn mở thử `?driver=kio`.
- [ ] **5.8 Việc của tôi**: nút **Bắt đầu đến** → **Đã đến, bắt đầu bốc** → **Hoàn thành** (ghi chú, ảnh xác nhận tùy chọn), hủy việc có lý do, **Xác nhận đã thu tiền** cho đơn tiền mặt.
- [ ] **5.9 Bot demo và panel `#/sim`**: bot tự báo giá (bật/tắt theo `app_settings`) cho mọi đơn, 🔁 chỉ dùng các thợ/tổ đội **đủ điều kiện nhận đơn** (`workers ≤ team_size`, cá nhân không báo đơn ≥ 2 thợ), nút đẩy trạng thái đơn.
- [ ] **5.10 Polling**: khách và thợ tự cập nhật đơn/báo giá mỗi 3–5 giây, dọn timer khi rời màn.

**Demo cuối giai đoạn 5**: mở 2 tab (khách + thợ): khách đặt đơn, thợ báo giá, khách chọn thợ, thợ cập nhật tiến độ tới hoàn thành.

### Giai đoạn 6 — Đơn hàng của khách

- [x] **6.1 Danh sách đơn**: 🆕 5 tab (Tất cả / Đang tìm thợ / Đang thực hiện / Hoàn thành / Đã hủy, cuộn ngang), 🆕 icon tìm kiếm ở header + ô "Tìm theo mã đơn hoặc địa chỉ…", nhóm theo tháng ("Tháng 10/2026"), thẻ đơn (icon + tên dịch vụ **đúng dịch vụ đã chọn**, nhãn trạng thái, ngày giờ, 2 địa chỉ bốc/dỡ rút gọn, số tiền), nút **Theo dõi** (đơn `finding` → màn Đang nhận báo giá), **Đặt lại**; bấm thẻ → Chi tiết.
- [x] **6.2 Chi tiết đơn**: 🆕 thẻ đầu (trạng thái, dịch vụ, mã đơn bấm copy, "x giờ trước"), 🆕 nút chia sẻ (→ in/PDF) và bookmark (không chức năng), timeline 5 mốc (ẩn khi hủy; 🆕 đơn hủy hiện dòng "Đơn hàng đã bị hủy"), bản đồ (kéo/phóng to/thu nhỏ; ẩn khi hủy), lộ trình (bốc, dỡ, khoảng cách), thông tin công việc (trọng lượng, tầng bốc + thang máy, cần dỡ hàng, tầng dỡ + thang máy, số thợ, ghi chú), ảnh hàng hóa bấm để phóng to, 🆕 video nếu có, khối Thanh toán (4 dòng giá + **Tổng tiền = số tiền khách trả**), nút đáy theo trạng thái (xem mục 4).
  🆕 *Đã làm* trong `js/screens/order-detail.js` (`#/orders/:id`) + `api.listOrderMedia`; bấm thẻ ở danh sách → chi tiết, **Theo dõi** vẫn vào `#/orders/:id/quotes`. Đơn `finding`: Xem báo giá + Hủy đơn (hộp thoại sẵn có). Chia sẻ tạm toast (in/PDF ở 6.5); bookmark không làm gì. Phí tầng 0đ thì ẩn dòng phí tầng như ảnh Excel. *Chưa làm*: 6.3 chọn lý do hủy, 6.5 in PDF.
- [ ] **6.3 Hủy đơn**: chọn lý do, hoàn tiền ví đúng quy tắc, ghi `order_events`.
- [ ] **6.4 Đặt lại**: tạo đơn mới điền sẵn từ đơn cũ (🆕 app gốc chưa làm, ta làm tốt hơn).
- [ ] **6.5 In / PDF**: CSS print cho chi tiết đơn (🆕 gắn vào nút chia sẻ).
- [ ] **6.6 Tự hủy hết hạn**: đơn `finding` quá 30 phút thì hủy "Không tìm được thợ".

**Demo cuối giai đoạn 6**: vòng đời đơn nhìn đủ từ phía khách, hủy và đặt lại hoạt động.

### Giai đoạn 7 — Ví, hoa hồng, khuyến mãi

- [x] **7.1 Ví khách**: 🆕 header "Ví của tôi" + nút đồng hồ (→ lịch sử); thẻ "Số dư khả dụng" có biểu tượng mắt ẩn/hiện + nút "+ Nạp tiền"; dòng ghi chú "Số dư dùng để thanh toán đơn bốc vác"; "Giao dịch gần đây" + "Xem tất cả". Màn **Lịch sử giao dịch**: 🆕 4 tab (Tất cả / Nạp tiền / Thanh toán / Hoàn tiền; Excel mô tả 3 tab, ảnh thật có thêm "Tất cả"), nhóm theo ngày ("Hôm nay"), mỗi dòng: loại giao dịch, giờ, số tiền, trạng thái (đang xử lý = gạch ngang + nhãn cam).
 🆕 *Đã làm* trong `js/screens/wallet.js` (`#/wallet`, `#/wallet/history`) + `api.getWallet/listWalletTransactions`; nền thẻ số dư dùng `uploads/img-giaodien/vivuatoi.png`. Nút **Nạp tiền** chờ task 7.2 (chưa có route thì toast "Nạp tiền sắp có."). *Chưa nối* hold/refund khi đặt đơn (7.3).
- [ ] **7.2 Nạp tiền giả lập**: thẻ số dư (ẩn/hiện), chip số tiền nhanh (🆕 50.000 / 100.000 / 200.000 / 500.000 / 1.000.000 / 2.000.000), ô nhập số khác, chọn **VNPay (QR / Ngân hàng)** hoặc **Ví MoMo** (🆕 ghi chú phí 0đ), nút "Nạp {số tiền}", màn cổng thanh toán giả, giao dịch pending → success/failed.
- [ ] **7.3 Hold / refund**: nối với đặt đơn, chọn thợ, hủy đơn (kiểm lại bằng test ca: đặt 500k, chọn thợ 400k → hoàn 100k).
- [x] **7.4 Mã giảm giá**: 🆕 ô nhập "VD: TTVNEW10" + nút Áp dụng, khung cảnh báo vàng (chỉ áp dụng từ 2 thợ), 3 tab Khả dụng / Đã dùng / Hết hạn, thẻ mã (tên, điều kiện "Đơn tối thiểu …", NSD, nhãn "Hết hạn"), trạng thái rỗng; áp dụng cho đơn ≥ 2 thợ, tính giảm trong `pricing.js`.
 🆕 *Đã làm* trong `js/screens/coupons.js` (`#/coupons`, bám ảnh 10) + `api.listMyCoupons/claimCoupon/checkCoupon/markCouponUsed` (cuối `ttv-api.js`) + `pricing.applyCoupon` + CSS `.cp-*`; bảng dùng: `ttv_coupons`, `ttv_user_coupons` (id = `uc-<user_id>-<mã>`, status available/used/expired). Nút **Áp dụng** = thêm mã vào danh sách của khách (báo lỗi: trống / không tồn tại / hết hạn / đã có / đã dùng). Tab **Hết hạn** luôn hiện mã hết hạn của hệ thống (như ảnh 10-2) cộng mã khách giữ đã quá hạn. `pricing.applyCoupon(amount, coupon, workers)`: chỉ ≥ `min_workers` (mặc định 2) và ≥ `min_order`, có trần `max_discount`, không để số tiền thấp hơn `min_amount`; `checkCoupon` từ chối đơn 1 thợ kèm lý do. *Chưa nối*: chọn mã khi đặt/chọn thợ và trừ vào `final_price` (cùng đợt nối hold/refund ở 7.3); khi nối gọi `markCouponUsed` để mã sang tab Đã dùng.
- [ ] **7.5 Phương thức thanh toán**: mặc định ví (hiện số dư)/tiền mặt, liên kết nguồn nạp (bấm → màn Nạp tiền).
- [ ] **7.6 Hoa hồng khi hoàn thành đơn**: tính `commission_amount`, `vendor_earning`, ghi `vendor_transactions`, trừ hoa hồng với đơn tiền mặt, khóa nhận đơn khi ví âm quá ngưỡng.
- [ ] **7.7 Ví thợ**: số dư, thu nhập theo đơn, hoa hồng đã trừ, lịch sử.
- [ ] **7.8 Rút tiền (thợ)**: form yêu cầu rút, trạng thái, lịch sử.

**Demo cuối giai đoạn 7**: nạp ví, đặt đơn trả ví, hoàn thành đơn thấy hoa hồng và thu nhập thợ đúng số.

### Giai đoạn 8 — Admin nâng cao

- [x] **8.1 Quản lý khách**: tìm kiếm, hồ sơ, đơn, ví, địa chỉ; khóa/mở; cộng/trừ ví thủ công (bắt buộc lý do); reset thiết bị.
  🆕 *Đã làm* trong `js/screens/admin/customers.js` (mới: `#/admin/customers`, `#/admin/customers/:id`, chỉ `SUPER_ADMIN`; module `customers` ở `admin.js` thêm cờ `own:true`) + `api.listCustomers/getCustomer/setCustomerStatus/adjustCustomerWallet/resetCustomerDevices` (cuối `ttv-api.js`, mục "8.1"); chuỗi chữ khóa `adminCust.*`; CSS khối "8.1". Khung mobile, không sidebar, bám mẫu `vendors.js`.
  - **Danh sách**: ô tìm (tên, SĐT — bỏ qua dấu cách/chấm/+84/0 đầu, email), chip *Tất cả / Hoạt động / Đã khóa* (kèm số lượng), phân trang 8 dòng, mới tạo trước; mỗi thẻ có nhãn trạng thái, số đơn, số dư ví. Có trạng thái đang tải / rỗng / không có kết quả / lỗi (Thử lại).
  - **Chi tiết** (5 tab chip): *Hồ sơ* (thông tin, hoạt động: tổng/hoàn thành/đang xử lý, nút Khóa/Mở khóa; khung cảnh báo khi đang khóa kèm ngày + lý do) · *Đơn* (dịch vụ, mã đơn, lộ trình, trạng thái, số tiền, 10 dòng đầu + "Xem thêm") · *Ví* (số dư, nút **+ Cộng tiền** / **− Trừ tiền**, lịch sử giao dịch) · *Địa chỉ* · *Thiết bị* (danh sách phiên + nút **Reset thiết bị**).
  - **Khóa / mở**: hộp xác nhận, khóa có ô lý do (≤ 200 ký tự). Khóa → `users.status='locked'`, `locked_at`, `lock_reason`, xóa các dòng `sessions` của khách; **đăng nhập OTP/Zalo/Google demo bị chặn** (`ACCOUNT_LOCKED`, toast "Tài khoản của bạn đã bị khóa…"); phiên đang mở ở tab chỉ bị hủy khi tải lại (`validateSession`, đã xử lý `status=locked` cho cả `users`). Mở khóa xóa `locked_at`/`lock_reason`. Gọi lại khi đã đúng trạng thái thì không ghi, không audit lặp.
  - **Cộng / trừ ví**: lý do **bắt buộc** (3–200 ký tự), số tiền nguyên VND 1.000–50.000.000 mỗi lần (gõ `50.000` hay `50000` đều được), trừ **không** làm ví âm (`INSUFFICIENT`). Đọc lại hồ sơ ngay trước khi ghi; ghi `users.wallet_balance` rồi `wallet_transactions` (cộng = `type:'topup'`, trừ = `type:'payment'`, `method:'admin'`, `status:'success'`, + `note` = lý do, `adjusted_by` = id admin), audit `customer.wallet_adjust` (số dư trước/sau, lý do) và gửi thông báo hệ thống cho khách. Lỗi kiểm tra trả `code:'VALIDATION'` + `err.errors` theo `direction/amount/reason` hiện ngay dưới từng ô. 🆕 **Đề xuất cần bạn duyệt**: để không đổi bảng đã chốt (mục 5) mình dùng lại `type` cũ và đánh dấu bằng `method:'admin'`; `wallet.js` (ví khách) hiện tiêu đề **"Điều chỉnh từ quản trị"** cho các dòng này (khóa `wallet.tx.adjust`), tab lọc vẫn xếp vào Nạp tiền / Thanh toán. Nếu muốn có `type:'adjust'` riêng thì báo để sửa `publicWalletTx`, `wallet.js`, mục 5.
  - **Reset thiết bị**: xóa mọi phiên của khách (đăng xuất khỏi mọi thiết bị), audit `customer.reset_devices` (số phiên đã xóa). Giới hạn demo như 3.4: phiên nằm sẵn trong `sessionStorage` của tab khác chỉ mất khi tải lại trang (chưa có polling).
  - **Bảng/trường mới**: `users` + `status`(active/locked; thiếu = active), `locked_at`, `lock_reason`; `wallet_transactions` + `note`, `adjusted_by` (chỉ dòng admin). Audit: nhóm mới `customer` (`customer.lock/unlock/wallet_adjust/reset_devices`) đã thêm vào `api.AUDIT_GROUPS`, `audit-logs.js` (icon/nhãn) và nhãn `adminLog.*` — detail không chứa SĐT/email, chỉ tên + lý do + số tiền.
  - 🆕 **Avatar khách** (cập nhật sau): danh sách và đầu trang chi tiết khách hiện ảnh `users.avatar_path` nếu có, không có/ảnh lỗi thì chữ cái đầu (dùng chung `TTV.screens.admin.avatarHtml`, xem 3.4).
  - 🆕 Chưa có trong 8.1 (không thuộc task): sửa hồ sơ khách, xóa khách, cấp mã giảm giá (8.5). (Xem chi tiết một đơn từ hồ sơ khách: đã nối ở 8.2.)
  - *Đã kiểm tra*: Node với kho dữ liệu giả — API 30 ca (quyền khách/thợ bị `FORBIDDEN`, khóa/mở/lặp, chỉ xóa phiên của đúng khách, chặn đăng nhập demo, cộng/trừ, trừ quá số dư, các lỗi `VALIDATION`, trần số tiền, audit không lộ SĐT, reset chỉ đúng khách) và giao diện 18 ca (danh sách, 5 tab, escape, "Xem thêm", cửa sổ ví/khóa/reset, trạng thái rỗng/lỗi/không tìm thấy, không thiếu khóa chữ); **chưa chạy trên trình duyệt thật / KIO thật**.
- [x] **8.2 Quản lý đơn**: lọc theo trạng thái/dịch vụ/ngày, chi tiết, báo giá, timeline.
  🆕 *Đã làm* trong `js/screens/admin/orders.js` (mới: `#/admin/orders`, `#/admin/orders/:id`, chỉ `SUPER_ADMIN`; module `orders` ở `admin.js` thêm cờ `own:true`) + `api.listAdminOrders/getAdminOrder` và hằng `api.ADMIN_ORDER_STATUSES` (cuối `ttv-api.js`, mục "8.2"); chuỗi chữ khóa `adminOrd.*`; CSS khối "8.2". Khung mobile 430px, không sidebar, bám mẫu `customers.js`. **Màn này CHỈ ĐỌC**: không ghi `orders`/`quotes`/`wallet_transactions`, không ghi `audit_logs` (gán thợ / đổi trạng thái / hủy + hoàn tiền là việc của 8.3, khi đó mới có nút thao tác và audit).
  - **Danh sách**: ô tìm (mã đơn có/không `#`, tên dịch vụ, tên khách, SĐT khách — bỏ qua dấu cách/chấm/+84/0 đầu, tên thợ, địa chỉ bốc/dỡ; **không phân biệt hoa thường và dấu tiếng Việt**); UI lọc gọn: thanh tìm kiếm + **nút phễu (SVG) bên phải**; bấm mở **sheet trượt từ dưới lên** (cùng kiểu sheet chọn điểm bốc/trả: tay nắm, tiêu đề + nút ×, chạm nền tối để đóng) chứa lọc *trạng thái* và *dịch vụ*, chọn là áp dụng ngay, chân sheet có *Đặt lại* và *Xem N đơn*; nút phễu có chấm số bộ lọc đang bật; chỉ hàng chip *ngày đặt* luôn hiện ngoài danh sách. Các bộ lọc: *trạng thái* (Tất cả / Đang tìm thợ / Đã ghép thợ / Thợ đang đến / Đang bốc vác / Hoàn thành / Đã hủy — 6 trạng thái thật của đơn, chi tiết hơn 4 nhóm của khách; số trong ngoặc là số đơn theo các bộ lọc còn lại), *dịch vụ* (Mọi dịch vụ + 7 dịch vụ đọc từ bảng `services`), *ngày đặt* (Mọi lúc / Hôm nay / 7 ngày / 30 ngày — tính theo ngày dương lịch giờ máy, "7 ngày" gồm cả hôm nay — / Chọn ngày: ô *Từ ngày* và *Đến ngày*, gồm cả ngày cuối; khoảng ngược thì báo lỗi đỏ và tạm không lọc ngày). Nút **Xóa bộ lọc** (chỉ hiện khi đang lọc) và **Làm mới** (đọc lại KIO bỏ qua cache 30 giây; giữ nguyên bộ lọc). Phân trang 8 dòng, mới nhất trước. Thẻ đơn: tên dịch vụ + mã, lộ trình, `Khách: … · Thợ: …`, nhãn trạng thái, nhãn **Quá hạn báo giá** (đơn `finding` đã quá `quote_deadline`), nhãn **Đơn mẫu** (cờ `demo`), số tiền (`≤ user_offer` khi chưa ghép thợ, `final_price` khi đã ghép), số thợ, số báo giá (cam nếu còn báo giá chờ chọn). Có trạng thái đang tải / rỗng / không có kết quả / lỗi (Thử lại).
  - **Chi tiết** (3 tab chip): **Chi tiết** = thẻ *Khách hàng* (tên, SĐT, email, trạng thái tài khoản + nút *Xem hồ sơ khách* → `#/admin/customers/:id`), *Thợ nhận đơn* (tên, loại · số thợ, SĐT, đánh giá, số đơn đã làm + nút *Xem hồ sơ thợ* → `#/admin/vendors/:id`; chưa ghép thì ghi "Chưa ghép thợ"), *Lộ trình*, *Thông tin công việc* (dịch vụ, trọng lượng, tầng bốc/dỡ + thang máy, số thợ, tốc độ, loại nhà cung cấp, hạn nhận báo giá, ghi chú), *Thanh toán* (phương thức, **số khách đặt tối đa** = `user_offer`, mức hiện tại của đơn Gấp, **khách thực trả** = `final_price`, mã giảm giá, hoa hồng + tiền thợ nhận + đã thu tiền mặt khi đơn đã hoàn thành) kèm thẻ *Giá tham khảo* (4 dòng + tổng, ghi rõ không phải số khách trả), *Ảnh và video* (hiện trạng khi đặt và minh chứng hoàn thành tách hai nhóm; ảnh bấm để mở, ảnh lỗi hiện "Không tải được"); **Báo giá (n)** = mọi báo giá **ở mọi trạng thái** (Chờ chọn / Được chọn / Không được chọn / Đã rút / Hết hạn), xếp thấp → cao, mỗi thẻ có tên thợ, loại + số thợ, ★, ETA, lời nhắn, giờ gửi/sửa/rút, "Thấp hơn mức đặt …", giá; báo giá được chọn được tô xanh; bấm → hồ sơ thợ; **Tiến trình** = 5 mốc (Đã tạo → Hoàn thành, mốc chưa tới ghi "Chưa tới"; đơn hủy chỉ hiện các mốc đã qua + bước đỏ "Đơn bị hủy" kèm lý do và giờ) và **Nhật ký sự kiện** từ `order_events` theo thứ tự thời gian (sự kiện, ghi chú, người thực hiện `Khách/Thợ/Quản trị/Hệ thống: tên`, giờ có giây). Đầu trang: tên dịch vụ, mã đơn bấm để sao chép, "Tạo x trước", nhãn trạng thái, khung vàng khi đơn quá hạn báo giá, khung cảnh báo khi đơn đã hủy (lý do + giờ), nút Làm mới.
  - **Quy tắc đọc**: `listAdminOrders`/`getAdminOrder` kiểm quyền (`SUPER_ADMIN`, nếu không → `FORBIDDEN`), gọi `Store.invalidate` để thấy dữ liệu mới ngay, **không tự hủy đơn hết hạn** (chỉ gắn cờ `overdue`; việc tự hủy là 6.6). Khách/thợ đã bị xóa khỏi DB thì hiện "Tài khoản không còn tồn tại", không báo lỗi. Admin được xem SĐT đầy đủ của khách và thợ (khác khu thợ). Mọi chuỗi từ DB đều được escape.
  - 🆕 **Lịch sử công việc của thợ** (thêm theo yêu cầu, ngoài danh sách 8.x): tab *Cá nhân* của thợ có mục **Lịch sử công việc** (nhóm Hoạt động, sau *Báo giá của tôi*) → `#/vendor/history` (`js/screens/vendor-history.js`, chỉ `VENDOR`). Liệt kê đơn **đã hoàn thành** của chính thợ (`api.listVendorHistory`, mới nhất trước; không lẫn đơn đang làm hay đơn của thợ khác), thẻ cùng kiểu *Việc của tôi* (dịch vụ, mã, giờ hoàn thành, lộ trình, nhãn Hoàn thành, **Thực nhận** = `vendor_earning` nếu có, không thì **Khách trả** = `final_price`), 10 đơn/lần + nút *Xem thêm*, có trạng thái đang tải / rỗng / lỗi (Thử lại). Bấm thẻ mở Chi tiết đơn `#/vendor/market/:id` (màn có sẵn, đã hỗ trợ đơn hoàn thành của chính thợ); nút Quay lại về lịch sử. Đã kiểm tra trên Chromium thật: 12 điều kiện đạt.
  - 🆕 Nối thêm cho 8.1: ở `#/admin/customers/:id` → tab **Đơn**, bấm một đơn mở thẳng `#/admin/orders/:id` (sửa nhỏ `customers.js`, `?v=2`).
  - 🆕 Quy ước cho 8.3: màn chi tiết đã có sẵn `order.status`, `order.vendor`, `order.quotes`, `final_price`, `pay_method`; nút can thiệp gắn vào đầu trang chi tiết (`.admin-detail-head`), sau mỗi lần ghi gọi lại `loadDetail` (đã có nút Làm mới dùng cùng hàm), và ghi `audit_logs` nhóm mới `order` (thêm vào `api.AUDIT_GROUPS`, nhãn `adminLog.*` như quy ước ở 3.7).
  - *Đã kiểm tra*: chạy thử trên **Chromium thật (Playwright) với `?driver=local`**, khung 430px: 54 điều kiện đạt (gồm sheet lọc) + 1 ca nối từ hồ sơ khách sang chi tiết đơn (7 đơn mẫu đủ 6 trạng thái; lọc trạng thái / dịch vụ / hôm nay / 7 / 30 ngày / khoảng tùy chọn / khoảng ngược; tìm theo mã, SĐT, địa chỉ không dấu; chi tiết đơn đang tìm / quá hạn / đã ghép / hoàn thành / đã hủy / khách bị xóa / không tồn tại; 3 báo giá xếp thấp → cao, đã rút / chờ chọn / được chọn; timeline đủ 5 mốc và đơn hủy; ảnh lỗi; escape HTML ở tên khách và lời nhắn; không tràn ngang; `FORBIDDEN` khi chưa đăng nhập, route về `#/staff-login`; không có lỗi JS). **Chưa chạy trên KIO thật** (môi trường thử không có mạng tới `kio.dvqt.vn`) — code chỉ dùng `Store.list/get/query` như các màn khác nên cần bạn mở thử `?driver=kio`.
- [ ] **8.3 Can thiệp đơn**: gán thợ thủ công, đổi trạng thái, hủy và hoàn tiền (đều ghi audit).
- [ ] **8.4 Tài chính**: giao dịch ví, duyệt nạp tiền đang xử lý, **duyệt yêu cầu rút tiền**, đối soát hoa hồng.
- [x] **8.5 Khuyến mãi**: tạo/sửa/tắt mã, cấp mã cho khách, quản lý banner (upload ảnh, đích).
  🆕 *Đã làm* trong `js/screens/admin/promotions.js` (mới: `#/admin/promotions`, `#/admin/promotions/coupons/new|:code|:code/edit`, `#/admin/promotions/banners/new|:id|:id/edit`, chỉ `SUPER_ADMIN`; module `promotions` ở `admin.js` thêm cờ `own:true`) + `api.listAdminCoupons/getAdminCoupon/saveAdminCoupon/setCouponStatus/deleteAdminCoupon/grantCouponToCustomer/listAdminBanners/getAdminBanner/saveAdminBanner/setBannerActive/deleteAdminBanner` (cuối `ttv-api.js`, mục "8.5"); chuỗi chữ khóa `adminPromo.*`; CSS khối "8.5". Khung mobile, không sidebar, bám mẫu `customers.js`.
  - **Mã giảm giá**: danh sách + chip *Tất cả / Đang bật / Đã tắt / Hết hạn*, tìm theo mã/tiêu đề, phân trang 8. Tạo/sửa: mã (4–20 chữ in hoa+số, khóa khi sửa, nút Sinh mã), tiêu đề, **ảnh** (tùy chọn, `uploads/{adminId}/coupon-images/`), **dịch vụ** (chip từ bảng `services`: chọn tất cả hoặc một vài; `services[]` trống = mọi dịch vụ, mã cũ không có trường này vẫn dùng được), điều kiện (trống thì tự điền theo đơn tối thiểu), loại % hoặc số tiền, trần giảm (chỉ %), đơn tối thiểu, số thợ 1–10, hạn dùng. Tắt/bật (`status=disabled/active`); xóa chỉ khi chưa có khách **dùng** mã (đã cấp chưa dùng thì gỡ luôn `user_coupons`). Cấp mã: chọn một/nhiều khách hoặc **cấp tất cả** (bỏ qua khóa / đã có / đã dùng) → ghi `user_coupons` + thông báo khuyến mãi `#/coupons` (ghi hàng loạt, không quét hộp thư). Mã tắt: khách không nhập được, ẩn khỏi ví mã (chưa dùng); `pricing.applyCoupon` từ chối (kèm lọc dịch vụ khi biết mã dịch vụ của đơn).
  - **Banner**: danh sách theo `sort`; tạo/sửa ảnh (upload `uploads/{adminId}/banners/`, hoặc giữ ảnh seed `uploads/img-giaodien/…`), tiêu đề, phụ đề, loại promo/member/explore, đích coupon/none, thứ tự 1–99, ẩn/hiện (`active`). Trang chủ khách dùng `image_path` nếu có. `listBanners` vẫn lọc `active !== false`.
  - **Audit** nhóm mới `promo`: `promo.coupon.create/update/disable/enable/delete/grant`, `promo.banner.create/update/delete/toggle`. Detail không chứa SĐT.
  - *Chưa nối*: chọn mã khi đặt đơn (7.3). **Chưa chạy trên KIO thật** — cần mở `#/admin/promotions?driver=kio`.
- [ ] **8.6 Nội dung**: FAQ, 3 tab Điều khoản & Chính sách (có ngày cập nhật), gửi thông báo hệ thống (`broadcasts`).
- [ ] **8.7 Hỗ trợ**: xử lý báo cáo (Mới/Đang xử lý/Đã đóng) kèm phản hồi; ẩn/xóa đánh giá vi phạm.
- [ ] **8.8 Dashboard thật**: đơn hôm nay, GMV, hoa hồng, khách mới, tỉ lệ ghép thành công, đơn không tìm được thợ, biểu đồ ngày/tuần.
- [ ] **8.9 Kiểm tra guard vai trò**: 🔁 đăng nhập `CUSTOMER` / `VENDOR` / `SUPER_ADMIN`, xác nhận mỗi vai trò chỉ vào đúng khu và chuyển hướng chéo đúng (không còn ma trận quyền con).

**Demo cuối giai đoạn 8**: admin xử lý trọn một đơn lỗi, duyệt một yêu cầu rút tiền, dashboard khớp số liệu.

### Giai đoạn 9 — Phụ trợ và hoàn thiện

- [x] **9.1 Thông báo** (cả 3 vai trò): chuông, 🆕 4 tab Tất cả / Đơn hàng / Khuyến mãi / Hệ thống, 🆕 dòng đếm "N thông báo", nhóm theo ngày ("Hôm nay"), nhãn loại nhỏ (ĐƠN HÀNG…), nút xóa từng dòng, trạng thái rỗng, click vào đơn → chi tiết; sinh thông báo ở các sự kiện đơn (🆕 "Đơn hàng đã được tạo!", "Không tìm được thợ" khi tự hủy…), rút tiền, broadcast. Hiển thị mã đơn ngắn, không hiện UUID.
  🆕 *Đã làm màn khách* `#/notifications` (ảnh 04) + `api.listMyNotifications/markNotificationRead/markAllNotificationsRead/deleteNotification` (lọc theo `recipient_type` + `recipient_id`). Chuông Trang chủ/Cá nhân đã nối sẵn. Mã đơn hiện `#` + 8 hex, không UUID. Tab Khuyến mãi/Hệ thống và khu thợ/admin dùng cùng API khi có dữ liệu (broadcast/rút tiền làm ở 8.6/7.8; tự hủy "Không tìm được thợ" ở 6.6).
  - 🆕 **Tối ưu realtime thông báo** (đỡ lag trên KIO): (1) *Poll 4 giây chỉ hỏi "có gì mới không"*: `NotiLive.refresh` đọc mốc nhỏ của riêng mình (`api.getNotiStamp()` → bảng `noti_marks`), mốc không đổi thì KHÔNG tải `notifications`; mốc đổi mới tải danh sách. Mọi thay đổi hộp thư (`pushNotification`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification`, dọn) đổi mốc **sau khi** dữ liệu đã ghi xong. Poll không còn xóa cache thông báo; bỏ chuỗi thử lại 3 lần × 400ms sau mỗi ping; vẫn tải đầy đủ mỗi 5 phút (`SAFETY_MS`) phòng khi ghi mốc hỏng. Ping của chính mình (bấm đọc, có noti mới cùng trình duyệt) vẫn tải ngay. (2) *Giữ tối đa 20 ngày và 100 thông báo mỗi người* (`NOTI_KEEP_DAYS`, `NOTI_KEEP_MAX` trong `ttv-api.js`): `listMyNotifications` chỉ trả phần giữ lại (ẩn ngay) và xóa phần dư ở nền; `pushNotification` cũng dọn hộp thư người nhận khi thêm (dùng chung lần đọc đã có để tìm dòng trùng). Xóa nhiều dòng dùng `Store.removeAll` (một lần đọc bảng, không đọc lại cả bảng cho từng dòng). (3) Store: bảng mới `noti_marks`, `DB_VERSION` IndexedDB 1 → 2 (dữ liệu cũ giữ nguyên); KIO tự tạo bảng khi ghi lần đầu. Đã đo trên Chromium (`?driver=local`, hộp thư 130 thông báo): 27 giây đứng yên, bản cũ đọc cả bảng 7 lần, bản mới 2 lần (tải đầu + sau lần dọn đầu) rồi 0 lần; thông báo mới từ "máy khác" (không ping) hiện sau ~2,5 giây. **Chưa đo trên KIO thật.** Lưu ý: người dùng không mở app thì thông báo quá hạn của họ chưa bị xóa cho đến khi họ mở lại hoặc nhận thông báo mới.
  - 🆕 **Nhận thông báo khi chuyển sang tab khác** (trước đây `noti-live.js` bỏ poll khi `document.hidden`): nhịp poll chạy trong **Web Worker** (timer trong worker không bị trình duyệt giãn nhịp ở tab nền; không tạo được worker thì dùng `setInterval`); tab đang hiện 4 giây/lần làm mới mọi thứ như cũ, **tab bị ẩn 8 giây/lần và chỉ hỏi thông báo** (đơn/báo giá tự làm mới ngay khi quay lại tab). Khi có thông báo mới lúc tab ẩn: phát chuông (đã mở khóa âm thanh từ thao tác đầu tiên), **thông báo hệ thống** `Notification` (nhiều hơn 3 cái cùng lúc thì gộp một; bấm vào mở đúng đích như bấm trong danh sách), và **số chưa đọc trên tiêu đề tab** `(N) TingTingVac…` (bỏ khi quay lại tab). Quyền thông báo hệ thống được xin **đúng 1 lần** ở thao tác chạm đầu tiên sau khi đăng nhập (cờ `ttv_noti_perm_asked` trong localStorage; muốn hỏi lại thì xóa cờ hoặc đổi quyền trong cài đặt trình duyệt). **Giới hạn**: chỉ hoạt động khi trình duyệt còn chạy và tab còn tồn tại (Memory Saver của Chrome hay điện thoại khóa máy có thể treo/đóng tab); nhận thông báo khi đã đóng hẳn trình duyệt cần Web Push (service worker + máy chủ gửi push), chưa làm.
- [ ] **9.2 Cài đặt thông báo và Cài đặt chung**: toggle thông báo (🆕 Thông báo đơn hàng: cập nhật trạng thái, thợ đang đến…; Khuyến mãi & ưu đãi: mã giảm giá, sự kiện; Thông báo hệ thống: cập nhật, bảo trì) + 🆕 "Âm thanh & rung". **Cài đặt chung**: 🆕 Ngôn ngữ (Tiếng Việt; Tiếng Anh khóa "Sắp có"), Giao diện (Sáng / Tối / Theo hệ thống; Tối làm ở 9.7), nút **Xóa bộ nhớ đệm** (không xóa đăng nhập), **Về TingTingVac** (→ Điều khoản & Chính sách), Đăng xuất.
- [x] **9.3 Đánh giá**: khách đánh giá đơn hoàn thành (tab Chờ đánh giá/Đã đánh giá); thợ xem và phản hồi.
  🆕 *Đã làm* `#/reviews` (ảnh 20: 2 tab + empty), `#/orders/:id/review` (avatar + 5 sao + nhãn Tuyệt vời…, gửi nhận xét tùy chọn). Đơn `completed` chưa đánh giá: chi tiết có nút **Đánh giá**; khi khách đang mở chi tiết mà thợ hoàn thành thì tự mở màn chấm sao (1 lần/đơn trong phiên). Mỗi đơn 1 đánh giá; `vendors.rating` = trung bình các đánh giá chưa ẩn. Thợ: `#/vendor/reviews` xem + phản hồi (`vendor_reply`).
- [ ] **9.4 Bảo mật và thiết bị đăng nhập**: 🆕 màn Bảo mật có thẻ "trạng thái bảo vệ" (phương thức đăng nhập, ngày tạo tài khoản), tùy chọn Đăng nhập sinh trắc học (Sắp có), Đổi mã PIN (Sắp có), Thiết bị đăng nhập, nút "Đăng xuất khỏi thiết bị này". Màn **Thiết bị đăng nhập**: danh sách phiên, trạng thái hoạt động, dấu tích "Thiết bị này", đăng xuất thiết bị khác (🆕 Excel ghi chú: cần cơ chế quản lý phiên — dùng bảng `sessions`).
- [ ] **9.5 Trợ giúp**: 🆕 màn Trợ giúp & Hỗ trợ có khối **liên hệ** (Gọi tổng đài `tel:`, Chat Zalo OA — Sắp có, Gửi email `mailto:`) và khối **Tự trợ giúp** (Câu hỏi thường gặp, Hướng dẫn đặt đơn → FAQ tab Đặt đơn, Chính sách hoàn tiền → Điều khoản tab hoàn tiền, Báo cáo sự cố); FAQ 4 tab (Đặt đơn / Thanh toán / Ví / Tài khoản) + tìm kiếm + nút "Liên hệ hỗ trợ"; Điều khoản & Chính sách 3 tab (Điều khoản sử dụng / Chính sách bảo mật / Chính sách hoàn tiền) có "cập nhật lần cuối"; gửi và xem **Lịch sử báo cáo** (khách và thợ). 🆕 "Báo cáo sự cố" ở app gốc mở app mail của thiết bị; ta làm form trong app (ghi `reports`) và có thêm liên kết gửi email.
- [x] **9.6 Hồ sơ thợ**: ảnh đại diện, **họ tên, số điện thoại, phương tiện**, dịch vụ, khu vực (🔁 không có giấy tờ).
  🆕 *Đã làm* trong `js/screens/vendor-info.js` (mới: `#/vendor/info`, chỉ `VENDOR`; mở từ **Cá nhân → Hồ sơ thợ**, mục tự sáng lên) + `api.updateVendorProfile` (ngay sau `getVendorSelf` trong `ttv-api.js`); chuỗi chữ khóa `vendorInfo.*`; CSS `.vi-*` (khối "9.6" cuối `style.css`). Khung mobile, header ‹, nút **Lưu thay đổi** dính đáy (chỉ bật khi có thay đổi).
  - 🔁 **Cập nhật (thợ tự sửa thêm họ tên, SĐT, phương tiện)**: thẻ mới **Thông tin liên hệ** gồm 3 ô nhập: *Họ tên* (2–80 ký tự), *Số điện thoại* (chỉ mã vùng VN, lưu dạng `0xxxxxxxxx`, **không được trùng thợ khác**, giữ SĐT cũ không báo trùng), *Phương tiện* (tùy chọn, ≤ 60 ký tự, gợi ý `<datalist>` từ `api.VENDOR_VEHICLES`, để trống = xóa). Chỉ còn **chỉ đọc**: loại hình (+ số thợ) và tên đăng nhập (kèm dòng "liên hệ quản trị viên"); email, hoa hồng, ví, đánh giá vẫn không hiện/không sửa ở đây. `api.updateVendorProfile` nhận thêm `name?`, `phone?`, `vehicle?` (`undefined` = giữ nguyên), báo lỗi `VALIDATION` theo `name`/`phone`/`vehicle`, kiểm trùng SĐT bằng `vendorConflicts`, **đọc lại hồ sơ lần nữa ngay trước khi ghi** (kiểm lại `LOCKED`), đổi tên xong cập nhật `name` trong session (lời chào Trang chủ thợ đổi ngay). Ô nhập chỉ ghi vào state khi gõ (không vẽ lại cả trang) để không mất con trỏ / không làm hỏng bộ gõ tiếng Việt. Vẫn không ghi `audit_logs` (thao tác của chính thợ); admin vẫn sửa được mọi trường ở 3.4. *Đã kiểm tra trên Chromium thật (`?driver=local`)*: ô điền đúng dữ liệu, nút Lưu chỉ bật khi có thay đổi, SĐT trùng báo lỗi, lưu hợp lệ ghi đúng DB + cập nhật session, về tab Cá nhân; **chưa chạy trên KIO thật**.
  - **Thợ tự sửa 3 thứ** (nội dung gốc, nay là 6 thứ — xem dòng 🔁 ở trên): (1) **Ảnh đại diện**: chọn file → xem trước (blob), nút *Xóa ảnh*, chỉ nhận file ảnh ≤ 10 MB; file chỉ được ghi vào `uploads/{id thợ}/avatar/` bằng `TTV.Upload` **khi bấm Lưu** (thoát giữa chừng không để file mồ côi), lưu nguyên bản không nén, DB chỉ lưu `vendors.avatar_path`; ảnh lỗi thì hiện chữ cái đầu. (2) **Dịch vụ nhận đơn**: chip chọn trong 7 dịch vụ (đọc bảng `services`) + nút *Chọn tất cả / Bỏ chọn tất cả*, ≥ 1. (3) **Khu vực hoạt động**: chip theo `api.VENDOR_AREAS`, ≥ 1, **"Toàn TP.HCM" loại trừ từng quận/huyện** (giống form admin 3.3).
  - **Chỉ đọc** (admin sửa ở 3.4): loại hình (+ số thợ), tên đăng nhập, kèm dòng "liên hệ quản trị viên". Hoa hồng, ví, đánh giá không hiện ở đây. (Tên, SĐT, phương tiện: thợ tự sửa được, xem dòng 🔁 ở trên.) 🔁 Không có giấy tờ / xác minh (đã bỏ cùng 3.5).
  - **API** `updateVendorProfile({ avatar_path?, name?, phone?, vehicle?, services[], areas[] })`: kiểm quyền `VENDOR` (khách → `FORBIDDEN`), **đọc lại hồ sơ ngay trước khi ghi** (bỏ qua cache), tài khoản bị khóa → `LOCKED`; lỗi dữ liệu → `VALIDATION` + `err.errors` theo `services` / `areas` / `avatar_path` (dịch vụ phải có trong bảng `services`, khu vực phải nằm trong `VENDOR_AREAS`, không chọn cùng lúc Toàn TP.HCM + quận). `avatar_path`: bỏ trống/`undefined` = giữ ảnh cũ, `''` = xóa ảnh, còn lại **bắt buộc** bắt đầu bằng `uploads/<id thợ>/avatar/` và có đuôi file (chặn trỏ vào ảnh người khác, chặn `../`). **Chỉ ghi các trường trên** (không đụng loại, số thợ, email, hoa hồng, ví, đánh giá), không đổi gì thì không ghi, không trả `password_hash`/`salt`. Không ghi `audit_logs` vì đây là thao tác của chính thợ (quy ước audit chỉ cho thao tác admin).
  - **Hiệu lực**: dịch vụ/khu vực mới có tác dụng ngay ở Chợ đơn, chi tiết đơn và báo giá (các màn này đọc thẳng `vendors.services/areas`); báo giá đã gửi không bị ảnh hưởng. Lưu xong về tab Cá nhân.
  - *Đã kiểm tra*: Chromium thật (Playwright, `?driver=local`) — hiển thị đúng dữ liệu, bật/tắt nút Lưu, chọn tất cả/bỏ chọn, loại trừ khu vực, báo lỗi khi rỗng, file không phải ảnh, xem trước + xóa ảnh, 14 ca API (dịch vụ/khu vực/đường dẫn ảnh sai, ảnh của người khác, `../`, lưu đúng, không lộ hash, không ghi khi không đổi, giữ/xóa ảnh, `LOCKED`, `FORBIDDEN`), lưu qua giao diện rồi về tab Cá nhân, upload thất bại (chưa chọn thư mục `uploads/`) hiện lỗi rõ ràng và cho thử lại, không tràn ngang, không lỗi JS. **Chưa thử ghi file ảnh thật** (cần `showDirectoryPicker` do người dùng chọn thư mục trên Chrome/Edge) **và chưa chạy trên KIO thật**.
- [ ] **9.7 Dark mode**.
- [ ] **9.8 Trạng thái rỗng, lỗi, tải** rà soát toàn bộ màn hình.
- [ ] **9.9 Kiểm thử luồng chính** (liệt kê ở mục 9) và sửa lỗi.
- [ ] **9.10 README**: cách chạy, tài khoản demo, giới hạn bảo mật, giới hạn upload.
- [ ] **🆕 9.11 Đối chiếu với Excel**: đi qua bảng mục 12, mở từng ảnh `docs/reference/` cạnh màn hình tương ứng, ghi chênh lệch còn lại (nhãn chữ, thứ tự, trạng thái nút) và sửa.

---

## 9. Luồng kiểm thử chính (chạy ở 9.9, và sau mỗi giai đoạn nếu liên quan)

1. Khách đăng nhập OTP → onboarding → nạp ví → đặt đơn 1 thợ trả ví → thấy báo giá → chọn thợ → đơn hoàn thành → đánh giá.
2. Admin tạo thợ → thợ đổi mật khẩu → thợ vào chợ đơn → báo giá → được chọn → cập nhật tiến độ → ví thợ nhận tiền sau hoa hồng → thợ rút tiền → admin duyệt.
3. 🔁 Khách đặt đơn 3 thợ (có mã giảm giá) → thợ cá nhân không thấy đơn; đội 2 thợ không báo giá được; hai tổ đội ≥ 3 thợ cùng báo giá (mỗi đội ≤ mức tối đa) → khách thấy cả hai báo giá (thấp → cao) và chọn một → đội còn lại chuyển "Không được chọn"; một đội rút báo giá trước khi được chọn thì biến mất khỏi danh sách khách.
4. Đơn không ai nhận quá 30 phút → tự hủy → hoàn tiền ví.
5. Hủy đơn đã `matched` → hoàn tiền đúng, thông báo gửi đúng người.
6. 🔁 Khách và thợ gõ thẳng `#/admin/*` thì bị chặn + chuyển về khu của mình; `SUPER_ADMIN` vào được mọi mục admin.
7. 🆕 Khách đặt đơn trả tiền mặt → hủy ở màn Đang nhận báo giá → đơn sang tab Đã hủy, nút Đặt lại điền sẵn đúng dữ liệu.
8. 🆕 Khách nhập sai OTP 5 lần → bị khóa tạm; nhập mã giảm giá cho đơn 1 thợ → bị từ chối kèm lý do.

---

## 10. Giả định hiện tại (có thể sửa)

- Hoa hồng mặc định 15%.
- Thợ rút tiền do admin duyệt bằng tay.
- 🔁 Mọi đơn (1 thợ và ≥ 2 thợ) cùng quy trình báo giá, nhiều thợ/tổ đội báo giá, khách chọn, rút được khi chưa được chọn (đã chốt, thay cho "giá cố định + Nhận đơn"); khác biệt chỉ là điều kiện nhận đơn theo số thợ.
- Tài khoản admin đầu: `admin` / `Admin@12345` (bắt đổi lần đầu).
- Bản đồ dùng Leaflet + OSM thay VietMap cho tới khi có key.
- 🆕 Đơn giá tạm ở mục 4 (Chuyển nhà 50.000; 6 dịch vụ khác 100.000; phí trọng lượng mọi mức 100.000; 15.000 mỗi tầng; 5.000 mỗi km); hệ số tầng và km lấy từ **một** ảnh chụp.
- 🆕 Khu khách bám sát Excel; khu thợ và admin tự thiết kế theo cùng phong cách thị giác.
- 🆕 (3.3) Khu vực hoạt động của thợ tạm là "Toàn TP.HCM" + 22 quận/huyện TP.HCM (`api.VENDOR_AREAS`, sửa một chỗ khi chốt); quy mô tổ đội 2–50, công ty 2–500; email thợ bắt buộc; 🔁 thợ mới **không** có `kyc_status` (bỏ cùng 3.5, dùng được ngay); hoa hồng riêng để trống = dùng mặc định.

- 🔁 **Admin chỉ 1 vai trò `SUPER_ADMIN`** (đã chốt): bỏ `ADMIN`, `SUPPORT`, bỏ task 3.2, bỏ ma trận quyền; mọi thao tác admin vẫn ghi `audit_logs` (`actor_role` luôn là `SUPER_ADMIN`). `reports.assigned_to` hiện không cần dùng (chỉ 1 người xử lý).

## 11. Câu hỏi mở

- [x] ~~Nội dung kio-api~~ ✅ đã nhận adapter `KioStore` (ghi chú ở task 1.5). ~~Quyết định cũ: làm trên local trước, chưa ghi KIO.~~ 🔁 **Đã thay bằng quy tắc mục 0.9: làm trên KIO, bảng `ttv_<bảng>`** (mặc định `?driver=kio`). Còn lại: dán thêm `store.js` của HRM nếu muốn bám đúng giao diện.
- [ ] Có key VietMap không? Nếu có thì thay vào `map-service.js` ở task 4.3.
- [x] ~~Danh sách 7 dịch vụ và bảng giá~~ ✅ 7 dịch vụ từ Excel; giá cơ bản 6 dịch vụ còn lại và phí trọng lượng mọi mức tạm = 100.000đ (mục 4).
- [ ] Danh sách khu vực hoạt động của thợ (quận/huyện hay tỉnh/thành?) để làm bộ lọc ở 3.3 và 5.2. (Địa chỉ trong ảnh đều ở TP.HCM — Thủ Đức, Quận 12, Quận 8.) *Tạm ở 3.3: "Toàn TP.HCM" + 22 quận/huyện TP.HCM; chưa chốt nên chưa tick.*
- [x] 🆕 ~~Số tiền khách trả~~ ✅ khách nhập số tiền **tối đa**; số tiền thực trả tính từ giá thợ ra + lựa chọn của khách (mục 4).
- [x] 🆕 ~~Ví không đủ số dư~~ ✅ chặn + gợi ý nạp tiền + cho đổi sang tiền mặt (mục 4).
- [x] 🆕 ~~Dòng "thu trước khi ghép thợ"~~ ✅ chỉ hiện khi trả bằng ví.
- [x] 🆕 ~~Giá tự tính > số tiền tối đa~~ ✅ vẫn cho đặt; khách chọn Chấp nhận hoặc Không (rồi chọn thợ khác); xem mục 4 "Loại đơn".
- [ ] 🆕 Số dịch vụ hiển thị ở Trang chủ là 7 ô nhưng ảnh chỉ có 4 + 3 ô; có icon/ảnh gốc cho từng dịch vụ không, hay dùng emoji/SVG tạm?
- [ ] 🆕 (5.2) **"Gần nhất"** ở Chợ đơn: chưa có vị trí của thợ nên tạm hiểu là *quãng đường điểm bốc → điểm trả ngắn nhất*. Có muốn tính theo khoảng cách từ vị trí thợ tới điểm bốc không (cần thợ chia sẻ vị trí hoặc có "khu vực" tọa độ)?
- [ ] 🔁 **Mã giảm giá sau khi gộp quy trình**: đơn ≥ 2 thợ không còn "giá cố định", nên giảm giá tính trên giá báo giá của thợ được chọn hay chỉ trên `user_offer`? Và có cho đơn 1 thợ dùng mã nữa không? *Tạm giữ nguyên: chỉ đơn ≥ 2 thợ được dùng mã; giảm trừ vào `final_price` sau khi khách chọn thợ (chưa làm vì 7.4 chưa tới).*
- [ ] 🔁 **Báo giá dưới mức tối thiểu**: báo giá phải ≥ `pricing_config.min_amount` (10.000đ) và ≤ `user_offer`; có cần thêm sàn theo giá tự tính (ví dụ không dưới 50% giá tham khảo) để tránh báo giá quá thấp không? *Tạm: không.*
- [ ] 🆕 (5.3) **Giá "Gấp" tăng dần theo thời gian**: chưa có công thức (4.4 chưa làm). Tạm hiển thị `current_offer` nếu đơn có, không thì `user_offer`; công thức đưa vào `api.currentOffer` một chỗ khi chốt.
- [ ] 🆕 (5.2) Lọc khu vực so điểm bốc với tên quận/huyện trong **chuỗi địa chỉ**; đơn có địa chỉ không ghi quận/huyện sẽ không hiện cho thợ chỉ chọn quận (thợ "Toàn TP.HCM" luôn thấy). Cần lưu quận/huyện riêng khi chọn địa chỉ ở 4.3b không?
- [ ] 🆕 Có cần lưu "Lịch sử tìm kiếm" hoặc "Vị trí gần đây" trong modal chọn điểm không (ảnh không cho thấy)?
- [x] 🆕 ~~(5.7) Báo giá đã rút của thợ~~ ✅ **ẩn hẳn** khỏi màn Báo giá của tôi (không thêm tab thứ 5).
- [x] 🆕 ~~(9.6) Thợ tự sửa Phương tiện?~~ ✅ **có**: thợ tự sửa được họ tên, SĐT và phương tiện ở Hồ sơ thợ (cùng ảnh, dịch vụ, khu vực).

---

## 12. 🆕 Bảng đối chiếu 27 màn hình Excel ↔ task ↔ ảnh tham chiếu

Ảnh nằm ở `docs/reference/` (tên `NN-slug-k.jpg`, NN là số thứ tự màn, k là thứ tự ảnh trong màn). Số ảnh: Đặt đơn 9 ảnh; Đăng nhập, Onboarding, Thông báo, Địa chỉ, Ví, Chi tiết đơn… 2 ảnh; còn lại 1 ảnh.

| NN | Màn hình | Task chính | Task liên quan |
|---|---|---|---|
| 01 | Đăng nhập | 2.2 | 2.1 |
| 02 | Hoàn tất thông tin cá nhân | 2.3 | — |
| 03 | Trang chủ | 4.1 | 1.3 |
| 04 | Thông báo | 9.1 | 6.x |
| 05 | Đặt đơn bốc vác | 4.5–4.9 | 4.3b, 4.4 |
| 06 | Thêm địa chỉ | 4.2 | 4.3b |
| 07 | Sổ địa chỉ | 4.2 | — |
| 08 | Sửa địa chỉ | 4.2 | — |
| 09 | Đang nhận báo giá | 5.6 (khung ở 4.9) | 5.10, 6.6 |
| 10 | Mã giảm giá | 7.4 | 8.5 |
| 11 | Ví của tôi | 7.1 | 7.3 |
| 12 | Nạp tiền vào ví | 7.2 | 8.4 |
| 13 | Lịch sử giao dịch | 7.1 | — |
| 14 | Đơn hàng | 6.1 | 6.4 |
| 15 | Chi tiết đơn hàng | 6.2 | 6.3, 6.5 |
| 16 | Cá nhân | 2.6 | — |
| 17 | Cài đặt | 9.2 | 9.7 |
| 18 | Thông tin cá nhân | 2.6 | 1.7 |
| 19 | Phương thức thanh toán | 7.5 | 7.2 |
| 20 | Đánh giá của tôi | 9.3 | — |
| 21 | Cài đặt thông báo | 9.2 | — |
| 22 | Bảo mật | 9.4 | — |
| 23 | Thiết bị đăng nhập | 9.4 | 2.1 |
| 24 | Lịch sử báo cáo | 9.5 | 8.7 |
| 25 | Trợ giúp & Hỗ trợ | 9.5 | — |
| 26 | Câu hỏi thường gặp | 9.5 | 8.6 |
| 27 | Điều khoản & Chính sách | 9.5 | 8.6 |
