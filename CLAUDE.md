# CLAUDE.md — Ứng dụng đặt bốc vác (TTV)

Web app giả lập mobile cho dịch vụ đặt thợ bốc vác. Có 3 vai trò: **Khách**, **Thợ/Tổ đội/Công ty**, **Admin**. Không có backend thật, dữ liệu lưu ở IndexedDB (local) hoặc `window.kioStore` (KIO, bảng prefix `ttv_`).

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

---

## 1. Ngữ cảnh và ràng buộc

- **Nguồn thiết kế**: file Excel gốc (27 màn hình, 44 ảnh, giao diện xanh dương, mobile-first, bottom tab 4 mục cho khách). 🆕 Ảnh đã được tách ra `docs/reference/` (2,8 MB, đã đặt tên theo màn hình). Phần mô tả trong Excel chỉ cho **khu khách**; khu thợ và admin do ta tự thiết kế.
- **Tham chiếu kiến trúc**: repo HRM (README). **Chưa đọc được** `kio-api.js` và `store.js` của HRM (GitHub chặn truy cập tự động), nên lớp `store.js` hiện bám theo giao diện `list/get/put/remove/query`. Khi người dùng dán 2 file đó, chỉnh lại cho khớp.
- **Công nghệ** 🆕 (theo mẫu repo `hrm-frontend`): JavaScript thuần, **script thường — không ES module**, không build, không framework, không bundler. Mọi module gắn vào namespace toàn cục `window.TTV`; `index.html` nạp `<script>` theo thứ tự (có `?v=N` để phá cache, thêm file mới vào `index.html` khi làm task). Cấu hình ở `window.TTV_CONFIG` trong `index.html` (`mode`, `prefix`, `seedUser`, `seedPassword`). **Chạy bằng web server tĩnh, không dùng Python**: `npx serve .` hoặc XAMPP (mở qua http, không `file://`). Chỉ một file CSS `css/style.css`.
- **Giao diện**: khung giả app mobile rộng tối đa 430px, căn giữa trên desktop. Router theo hash. Riêng admin dùng bố cục rộng (sidebar + bảng).
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
  → IndexedDB (?driver=local, mặc định hiện nay) | KIO qua js/api/kio-api.js (?driver=kio, bảng prefix ttv_)
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

| Vai trò | Đăng nhập | Route gốc | Giao diện |
|---|---|---|---|
| Khách (`CUSTOMER`) | `/login`: SĐT +84 + OTP, Zalo (demo), Google (demo) | `#/home`, `#/create/order`, `#/orders`… | Giả app mobile, bottom tab: Trang chủ / Ví / Lịch sử / Cá nhân |
| Thợ (`VENDOR`) | `/staff-login`: username + mật khẩu do admin cấp, bắt đổi mật khẩu lần đầu | `#/vendor/*` | Giả app mobile riêng, có bottom tab |
| Admin (`SUPER_ADMIN` / `ADMIN` / `SUPPORT`) | `/staff-login`: username + mật khẩu. Tài khoản đầu `admin` / `Admin@12345`, bắt đổi lần đầu | `#/admin/*` | Bảng quản trị rộng |

- Mật khẩu băm SHA-256 + salt bằng `crypto.subtle`.
- Session lưu theo tab (để mở 3 tab test 3 vai trò cùng lúc). Mỗi vai trò poll KIO 3–5 giây để thấy đơn mới, báo giá mới.
- **Ma trận quyền admin**: `SUPER_ADMIN` làm tất cả (kể cả cấu hình, tài khoản admin). `ADMIN` làm vận hành (khách, thợ, đơn, tài chính, khuyến mãi, nội dung). `SUPPORT` chỉ xem khách/đơn, xử lý báo cáo, đánh giá, gửi thông báo.

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
| Thợ báo giá (bot demo) | Với đơn 1 thợ, sau vài giây sinh 2–4 báo giá từ bảng `vendors`. Admin bật/tắt bằng `app_settings`. Panel ẩn `#/sim` để đẩy trạng thái đơn |
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
  - 🆕 **`final_price` (số tiền khách thực trả) ✅ đã chốt**: được tính từ **giá thợ ra** và **các lựa chọn của khách** (tốc độ, mã giảm giá…), thường ≤ `user_offer`; ngoại lệ duy nhất là khi khách chủ động chấp nhận giá cao hơn mức tối đa ở đơn ≥ 2 thợ. Đơn 1 thợ: `final_price` = giá báo giá của thợ được chọn (đã qua các lựa chọn áp dụng); đơn ≥ 2 thợ (giá cố định): giá của mỗi tổ đội/công ty nhận đơn = giá tự tính từ `pricing.js` sau hệ số tốc độ và mã giảm giá; giá này **có thể vượt** `user_offer`, khi đó khách được **chọn chấp nhận hoặc không** (xem mục "Loại đơn"). Khi chọn thợ/ghép thợ: hoàn phần chênh lệch `user_offer − final_price` (đã tạm giữ nếu trả ví).
  - 🆕 Chi tiết đơn: trước khi ghép thợ, dòng tiền hiện nhãn "Số tiền tối đa bạn trả" = `user_offer`; sau khi ghép thợ hiện "Tổng tiền" = `final_price`.
- 🆕 **Số liệu suy ra từ ảnh (đưa vào seed 1.6, admin sửa được ở 3.6)**: ảnh mẫu: giá cơ bản 50.000đ, trọng lượng Vừa 57.000đ (chỉ để đối chiếu); phí tầng 15.000đ/tầng (2 tầng bốc có thang máy + 2 tầng dỡ không thang = 2×15.000×0,3 + 2×15.000 = 39.000đ ✔); phí km 5.000đ/km (1,38 km → 6.900đ ✔). 🆕 **✅ Tạm thời (đã chốt)**: giá cơ bản của 6 dịch vụ còn lại = **100.000đ**; phí trọng lượng của cả 4 mức (Nhẹ/Vừa/Nặng/Rất nặng) = **100.000đ**. Chuyển nhà giữ giá cơ bản 50.000đ. Admin chỉnh được ở task 3.6. (Con số 57.000đ ở ảnh mẫu bị thay bằng 100.000đ.)
- 🆕 Khoảng cách hiển thị 2 chữ số thập phân trong form/báo giá (1,38 km), làm tròn 1 chữ số ở Chi tiết đơn (1,4 km).

### Loại đơn
- **1 thợ**: đấu giá, nhận báo giá thật, **không** dùng mã giảm giá. Chỉ chọn nhà cung cấp "Cá nhân" khi số thợ = 1.
- **≥ 2 thợ**: giá cố định (giá tự tính), chỉ Tổ đội/Công ty, được dùng mã giảm giá. 🆕 **Nhiều tổ đội/công ty có thể cùng bấm Nhận đơn** (kèm ETA, lời nhắn); mỗi lượt nhận được ghi như một "đề nghị" ở bảng `quotes` với `price` = giá cố định. **Khách xem danh sách và chọn thợ mong muốn** (không còn "ai bấm trước được").
- 🆕 **✅ Giá tự tính > số tiền tối đa của khách**: vẫn cho đặt đơn. Với mỗi đề nghị vượt mức, màn Đang nhận báo giá hiện nhãn "Vượt mức tối đa +x đ" kèm 2 lựa chọn: **Chấp nhận** (trả giá cao hơn) hoặc **Không** — khi đó khách chỉ cần **chọn thợ khác** (các đề nghị còn lại vẫn nguyên, không phải hủy đơn). Khi khách bấm Chấp nhận: nếu trả ví thì kiểm tra số dư đủ phần chênh để tạm giữ thêm (không đủ → chặn + gợi ý Nạp tiền + cho đổi sang tiền mặt); nếu trả tiền mặt thì chỉ cần xác nhận.
- 🆕 Ở đơn 1 thợ, báo giá vẫn **≤ số tiền khách đặt** như cũ.
- 🆕 Mã giảm giá chỉ áp dụng ≥ 2 thợ; màn Mã giảm giá luôn hiện khung cảnh báo vàng giải thích điều này.

### Trạng thái đơn
`finding` → `matched` → `arriving` → `working` → `completed`, hoặc `cancelled`.
- `finding` hết 30 phút không ai nhận thì tự hủy với lý do "Không tìm được thợ".
- Timeline hiển thị 5 mốc (Đã tạo, Đã ghép thợ, Thợ đang đến, Đang bốc vác, Hoàn thành), ẩn khi đơn bị hủy.
- Chỉ đơn `completed` mới được đánh giá.
- 🆕 **Nhãn trạng thái hiển thị cho khách** (4 nhóm lọc ở danh sách đơn): *Đang tìm thợ* = `finding`; *Đang thực hiện* = `matched`/`arriving`/`working`; *Hoàn thành* = `completed`; *Đã hủy* = `cancelled`. Ngoài ra có tab **Tất cả** (tổng 5 tab).
- 🆕 **Nút theo trạng thái ở Chi tiết đơn**: `finding` → "Xem báo giá" + "Hủy đơn"; `cancelled` → "Đặt lại"; `completed` → "Đặt lại" (+ Đánh giá nếu chưa); các trạng thái còn lại không có nút hành động.
- 🆕 **Mã đơn hiển thị** `#` + 8 ký tự hex in hoa (ví dụ `#FF5C5148`), bấm để copy. Thời gian hiển thị dạng tương đối ("8 giờ trước") ở Chi tiết đơn, dạng `dd/MM/yyyy - HH:mm` ở danh sách.

### Báo giá (thợ)
- **Báo giá tối đa bằng số tiền khách đặt**. Mỗi thợ chỉ có 1 báo giá hiệu lực cho mỗi đơn; sửa/rút được khi chưa được chọn.
- Khách chọn thợ: báo giá đó → `accepted`, các báo giá còn lại → `rejected`, đơn → `matched`. Khách mới thấy SĐT thợ; thợ chỉ thấy SĐT khách sau khi được ghép.
- Thợ chỉ thấy đơn khớp: loại nhà cung cấp, số thợ ≤ quy mô đội, dịch vụ và khu vực của thợ.
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

### Bảng gốc

| Bảng | Trường chính |
|---|---|
| `users` | id, phone, name, email, gender, dob, avatar_path, login_method, kyc_status, default_pay_method, wallet_balance, lang, theme, created_at |
| `addresses` | id, user_id, label, type(home/office/warehouse/other), detail (≤ 250 ký tự), lat, lng, contact_name, contact_phone, is_default |
| `services` | code, name, desc, icon, base_price, unit |
| `pricing_config` | weight_tiers[], floor_fee, elevator_discount(0.7), km_fee, speed_multipliers, min_amount(10000), quote_window_min(30) |
| `orders` | id, code, user_id, service, pickup{addr,lat,lng}, dropoff{…}, distance_km, weight_tier, pickup_floor, pickup_elevator, need_unload, drop_floor, drop_elevator, workers, note, schedule_type, speed(default/fast/urgent/custom), provider_type, user_offer, price_breakdown{base,weight,floor,distance,discount}, total, pay_method, coupon_id, status, vendor_id, final_price, quote_deadline, timeline[], cancel_reason, created_at |
| `order_media` | id, order_id, kind(image/video), path, duration |
| `quotes` | id, order_id, vendor_id, price, eta_min, message, status, created_at |
| `wallet_transactions` | id, user_id, type(topup/payment/refund/hold), amount, method(vnpay/momo/wallet), status(pending/success/failed), order_id, created_at |
| `payment_methods` | id, user_id, type, is_default, linked_source |
| `coupons` | code, title, condition, min_workers, discount_type, discount_value, max_discount, min_order, expires_at |
| `user_coupons` | id, user_id, coupon_code, status(available/used/expired), used_order_id |
| `notification_settings` | user_id, order, promo, system, sound_vibrate |
| `reviews` | id, order_id, user_id, vendor_id, rating, comment, tags, created_at |
| `faqs` | id, category(order/payment/wallet/account), question, answer, sort |
| `policies` | type(terms/privacy/refund), content, updated_at |
| `banners` | id, image_path, type(promo/member/explore), target(coupon/none), sort |

### Sửa và thêm cho 3 vai trò

| Bảng | Thay đổi |
|---|---|
| `vendors` (sửa) | + username, password_hash, salt, must_change_pw, status(active/locked), kyc_status, team_size, services[], areas[], vehicle, commission_rate, is_online, wallet_balance, avatar_path, created_by. Giữ: name, type(personal/team/company), rating, phone, jobs_done |
| `staff` (mới) | id, username, password_hash, salt, name, role(SUPER_ADMIN/ADMIN/SUPPORT), status, must_change_pw |
| `sessions` (sửa) | id, device_name, platform, last_active, is_current, **account_type(customer/vendor/staff), account_id** |
| `orders` (sửa) | + accepted_quote_id, commission_rate, commission_amount, vendor_earning, cash_collected |
| `order_events` (mới) | id, order_id, event(created/quoted/matched/arriving/working/completed/cancelled), actor_type, actor_id, note, created_at |
| `quotes` (sửa) | + updated_at, withdrawn_at; status: pending/accepted/rejected/**withdrawn/expired** |
| `vendor_documents` (mới) | id, vendor_id, type(cccd/license/vehicle/other), path, status(pending/approved/rejected), note |
| `vendor_transactions` (mới) | id, vendor_id, type(earning/commission/withdraw/adjust), amount, order_id, status, created_at |
| `withdrawals` (mới) | id, vendor_id, amount, bank_name, bank_account, account_holder, status(pending/approved/rejected/paid), reviewed_by, reviewed_at |
| `reports` (sửa) | id, order_id, subject, content, status, created_at + reporter_type, reporter_id, assigned_to, replies[] |
| `broadcasts` (mới) | id, audience(customers/vendors/all), title, body, created_by, created_at |
| `audit_logs` (mới) | id, actor_id, actor_role, action, target_table, target_id, detail, created_at |
| `notifications` (sửa) | id, category(order/promo/system), title, body, order_id, is_read, created_at, **recipient_type + recipient_id** (thay user_id) |
| `reviews` (sửa) | + vendor_reply, hidden |
| `app_settings` (mới) | key, value (hoa hồng mặc định, bật bot demo, ngưỡng ví âm…). 🆕 Thêm khóa: `hotline`, `support_email`, `zalo_url`, `quick_topup_amounts` (50k/100k/200k/500k/1M/2M), `topup_fee` (0) |

🆕 Ghi chú bổ sung cho bảng:
- `users.kyc_status` hiển thị ở Trang Cá nhân như một nhãn "trạng thái định danh" (mặc định "Chưa định danh").
- `users.gender` / `dob` do màn Thông tin cá nhân sửa; **SĐT chỉ hiển thị, không sửa**.
- `orders.code` = 8 ký tự hex in hoa lấy từ `id`; chỉ dùng hiển thị.
- `notification_settings.sound_vibrate` ứng với công tắc "Âm thanh & rung".
- `payment_methods`: `type` gồm `wallet`/`cash`; `linked_source` = nguồn nạp ví đã liên kết (vnpay/momo).
- `reports`: bản khách cần xem được danh sách báo cáo mình đã gửi (Lịch sử báo cáo).

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
- Path: `uploads/{ownerId}/{loại}/{tên-ngẫu-nhiên}.{ext}`. Loại: `avatar`, `order-images`, `order-videos`, `vendor-docs`, `banners`.
- Ghi file bằng File System Access API (`showDirectoryPicker`): người dùng có thể chọn thư mục gốc của project (ứng dụng tự tạo `uploads/`) hoặc chọn trực tiếp thư mục `uploads/`. Lưu handle của chính thư mục `uploads/` trong IndexedDB, hỏi lại quyền khi cần; tránh tạo nhầm `uploads/uploads/`.
- DB chỉ lưu chuỗi đường dẫn tương đối, không lưu blob/base64 hay nội dung file. Hiển thị bằng `<img src="uploads/...">`; thư mục `uploads/` phải nằm bên trong thư mục gốc mà static server phục vụ, nếu không file ghi được nhưng URL sẽ trả lỗi.
- Ảnh được lưu nguyên bản, không resize, không nén và không chuyển đổi định dạng; giữ nguyên byte và phần mở rộng file gốc. Video giữ nguyên, thời lượng ≤ 2 phút, cảnh báo nếu file lớn. Tối đa 7 ảnh/đơn.
- 🆕 Ảnh tải lỗi/quá lâu: ô ảnh hiện trạng thái lỗi và dòng đỏ báo số ảnh lỗi (xem mục 4); không chặn đặt đơn. Video "quay" trên desktop = chọn file video (hoặc `getUserMedia` nếu làm được); có nút **Quay lại** (chọn lại) và **Xóa**, hiện thời lượng `mm:ss`.
- Cột path: `order_media.path`, `users.avatar_path`, `vendors.avatar_path`, `vendor_documents.path`, `banners.image_path`.
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
- [ ] **1.5 `store.js` driver KIO**: cùng giao diện, chọn driver bằng `?driver=local|kio`, prefix `ttv_`. 🆕 **Tạm hoãn**: giai đoạn đầu chỉ chạy driver `local`, không ghi lên KIO. Đã có `kio-adapter` (xem ghi chú dưới). Khi làm: bọc `KioStore` bằng `list/get/put/remove/query` (query lọc phía client trên `listCollection`).
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
- [x] **2.5 Guard theo vai trò**: chuyển hướng đúng khu vực, chặn truy cập chéo, đăng xuất. Đã làm trong `js/ui/router.js` + `js/api/ttv-api.js`: **guard trung tâm** chạy trước mọi route (`Router.checkAccess(path, session)`), khai báo theo khu vực bằng tiền tố route (khớp theo đoạn, `/homework` không bị nhầm với `/home`): khu khách (`/home`, `/profile`, `/orders`, `/wallet`, `/address`…) chỉ `CUSTOMER`; `/vendor/*` chỉ `VENDOR`; `/admin/*` chỉ `SUPER_ADMIN`/`ADMIN`/`SUPPORT`; `/change-password` cho thợ + staff. Chưa đăng nhập → về trang đăng nhập của khu đó (`/login` hoặc `/staff-login`); sai vai trò → về trang chính của vai trò mình kèm toast "Bạn không có quyền truy cập khu vực này."; đã đăng nhập mà vào `/`, `/login`, `/login/otp`, `/staff-login` → vào thẳng khu của mình. Phiên cần đổi mật khẩu (`must_change_pw`) bị ép về `/change-password` ở mọi khu; khách chưa có họ tên (session.name rỗng) bị ép về `#/onboarding` (không còn bỏ qua được bằng cách gõ thẳng `#/home`). Mọi chuyển hướng của guard dùng `navigate(path, {replace:true})` (`location.replace` thật) để nút Back không bị kẹt vòng lặp; `navigate({replace})` cũ chỉ thêm mục lịch sử nên đã sửa. Thêm `Router.has(path)`. `api.validateSession()` chạy lúc khởi động (trước `Router.start`): tài khoản trong phiên không còn (ví dụ xóa DB) hoặc bị khóa → hủy phiên; đồng bộ họ tên và cờ `must_change_pw` từ DB. **Đăng xuất**: `api.logout()` xóa thử thách OTP, bản nháp điểm trả (`ttv_draft_dropoff`) và phiên; staff ghi `audit_logs` `auth.logout`; `api.logoutAndGo()` về đúng trang đăng nhập của vai trò vừa thoát. Route chưa có màn (`/address`, `/settings`…) vẫn nằm trong khu khách nên khi task sau thêm route chỉ cần `Router.add`, không phải sửa guard. Chưa làm: ma trận quyền con của admin (`SUPPORT` không vào cấu hình/tài chính) — làm cùng các route admin ở 3.1/8.x bằng `roles` trong `Router.add`.
- [x] **2.6 Trang Cá nhân và Thông tin cá nhân** (khách): 
  - 🆕 **Cá nhân**: avatar, tên, SĐT che 3 số giữa, số đơn hoàn thành / đang xử lý, nhãn trạng thái định danh; nút chuông → Thông báo; nút bánh răng → Cài đặt; nút sửa/"Thông tin cá nhân"; danh sách mục: Sổ địa chỉ, Phương thức thanh toán, Mã giảm giá của tôi, Đánh giá của tôi, Thông báo, Bảo mật, Lịch sử báo cáo, Trợ giúp & Hỗ trợ, Điều khoản & Chính sách, **Đăng xuất** (các mục chưa có màn thì hiện "Sắp có" tạm, nối dần ở giai đoạn sau).
  - **Thông tin cá nhân**: avatar (upload), họ tên, SĐT (chỉ đọc), email, 🆕 giới tính, 🆕 ngày sinh; lưu thay đổi.
  🆕 *Đã làm* trong `js/screens/profile.js` (`#/profile`, `#/profile/info`, bám ảnh 16 và 18) + `api.getProfileStats/updateProfile/isValidDob/KYC_LABELS/GENDERS`. **Cá nhân**: avatar (có nút bút → Thông tin cá nhân; ảnh lỗi thì hiện chữ cái đầu), tên, SĐT dạng `0358 *** 915`, nhãn định danh (`users.kyc_status`: Chưa định danh / Đang chờ duyệt / Đã định danh / Bị từ chối), chuông (chấm đỏ khi có thông báo chưa đọc) → `#/notifications`, bánh răng → Cài đặt, thẻ thống kê (hoàn thành = `completed`; đang xử lý = mọi đơn chưa `completed` và chưa `cancelled`), 2 nhóm menu đúng thứ tự ảnh, dòng "Phiên bản 1.0.0", nút Đăng xuất có hộp xác nhận. Mục menu mở được khi route đã đăng ký (`Router.has`), nếu chưa thì hiện nhãn **"Sắp có"** và bấm chỉ báo toast — tự sáng lên khi task sau thêm route, không phải sửa `profile.js`; hiện chỉ Thông tin cá nhân là màn thật, Thông báo và Mã giảm giá mở màn tạm. **Thông tin cá nhân**: avatar + "Đổi ảnh" (chỉ xem trước; file ghi vào `uploads/{userId}/avatar/` bằng `TTV.Upload` khi bấm Lưu, nên thoát giữa chừng không để file mồ côi; ảnh ≤ 10 MB, lưu nguyên bản không nén; DB chỉ lưu `avatar_path`), họ tên (2–80 ký tự), SĐT chỉ đọc kèm "Không thể thay đổi" (API cũng bỏ qua mọi giá trị `phone` gửi lên), email (bắt buộc hợp lệ như ở onboarding), giới tính (Nam/Nữ/Khác hoặc chưa chọn), ngày sinh (`<input type="date">`, từ 1900 đến hôm nay, loại ngày không tồn tại như 31/02). Nút Lưu chỉ bật khi có thay đổi và hợp lệ; lưu xong cập nhật tên trong session, toast và về `#/profile`. Các chuỗi mới nằm trong `i18n.js` (khóa `profile.*`).

**Demo cuối giai đoạn 2**: đăng nhập được cả 3 vai trò, đổi mật khẩu lần đầu, đăng xuất, sửa hồ sơ khách.

### Giai đoạn 3 — Admin cơ bản

- [ ] **3.1 Khung admin**: sidebar, bảng dữ liệu dùng chung (tìm kiếm, phân trang, lọc), phân quyền menu theo role.
- [ ] **3.2 Quản lý staff** (SUPER_ADMIN): tạo/sửa/khóa tài khoản `ADMIN`/`SUPPORT`.
- [ ] **3.3 Tạo tài khoản thợ**: form đủ trường (tên, loại, SĐT, email, username, mật khẩu tạm có nút sinh ngẫu nhiên + copy, số thợ, dịch vụ (🆕 chọn trong 7 dịch vụ), khu vực, phương tiện, % hoa hồng riêng).
- [ ] **3.4 Danh sách và chi tiết thợ**: khóa/mở, reset mật khẩu, sửa thông tin.
- [ ] **3.5 Duyệt giấy tờ thợ**: xem tài liệu, duyệt/từ chối, huy hiệu "Đã xác minh".
- [ ] **3.6 Cấu hình giá và hệ thống**: sửa `pricing_config` (trọng lượng, tầng, giảm thang máy, km, hệ số tốc độ, phút chờ), `app_settings` (hoa hồng mặc định, bot demo, ngưỡng ví âm, 🆕 hotline, email hỗ trợ, link Zalo, các mức nạp nhanh).
- [ ] **3.7 Audit log**: ghi nhật ký mọi thao tác ở 3.2–3.6; màn xem nhật ký.
- [ ] **3.8 Dashboard khung**: các thẻ số liệu, dữ liệu thật sẽ nối thêm ở giai đoạn 8.

**Demo cuối giai đoạn 3**: admin tạo được thợ, thợ đăng nhập được bằng tài khoản vừa tạo, chỉnh giá có hiệu lực, audit log ghi đủ.

### Giai đoạn 4 — Địa chỉ và Đặt đơn (khách)

- [x] **4.1 Trang chủ khách**: 🆕 header xanh có lời chào theo giờ + chuông thông báo (🆕 chấm đỏ khi có thông báo chưa đọc); thẻ nổi gồm "Điểm bốc hàng…" (bấm → mở form đặt đơn) và "Bốc vác đến?" kèm nút **Dán** (đều mở form đặt đơn; 🆕 Dán = dán địa chỉ từ clipboard vào ô điểm trả); 7 ô dịch vụ (mở form với dịch vụ đã chọn); 🆕 carousel banner có chấm phân trang (thẻ ưu đãi hội viên, khuyến mãi → Mã giảm giá); "Khám phá thêm" (🆕 thẻ ảnh cuộn ngang, không click); nút Zalo nổi (🆕 mở `zalo.me`); bottom tab.
  *Xong khi*: bấm từng nút/ô mở đúng route, dịch vụ được truyền sang form.
- [ ] **4.2 Sổ địa chỉ**: 🆕 mô tả "Quản lý các địa chỉ bốc và địa chỉ đổ", ô tìm kiếm, danh sách thẻ (tên gợi nhớ, nhãn loại, nhãn **Mặc định**, địa chỉ chi tiết, người liên hệ + SĐT, nút Sửa / Xóa), trạng thái rỗng, nút "+ Thêm địa chỉ mới" dính đáy. Màn **Thêm/Sửa địa chỉ**: nút "Chọn trên bản đồ", tên gợi nhớ, địa chỉ chi tiết (🆕 bộ đếm ký tự /250), người liên hệ, SĐT, 4 chip loại (Nhà / Văn phòng / Kho / Khác), công tắc "Đặt làm địa chỉ mặc định" (🆕 phụ đề "Địa chỉ mặc định sẽ được ưu tiên khi tạo đơn hàng"), nút "Lưu địa chỉ" → về Sổ địa chỉ. Chỉ có 1 địa chỉ mặc định.
- [ ] **4.3 `map-service.js`**: Leaflet + OSM, tìm địa chỉ Nominatim, chọn điểm trên bản đồ, tính khoảng cách.
- [ ] **🆕 4.3b Modal "Chọn điểm bốc hàng / trả hàng"** (dùng chung cho form đặt đơn và form địa chỉ): bottom sheet gần toàn màn hình, ô tìm kiếm (gợi ý Nominatim), bản đồ có ghim, nút zoom +/−, nút "Vị trí của tôi", hiển thị địa chỉ đã chọn bên dưới, nút "Xác nhận địa điểm". Có thêm danh sách **địa chỉ đã lưu** để chọn nhanh và liên kết "+ Thêm" mở màn Thêm địa chỉ.
  *Xong khi*: chọn được điểm bằng tìm kiếm, bằng kéo ghim, bằng địa chỉ đã lưu; trả về `{addr, lat, lng}`.
- [ ] **4.4 `pricing.js`**: hàm tính giá theo mục 4, có unit test chạy bằng trang test đơn giản (`#/sim/pricing-test`).
  *Xong khi*: ≥ 8 ca test (thang máy, tầng, tốc độ, ≥ 2 thợ, mã giảm giá) cho kết quả đúng. 🆕 Trong đó có ca mẫu: Chuyển nhà, Vừa, bốc 2 tầng có thang máy, dỡ 2 tầng không thang máy, 1,38 km → 50.000 / 100.000 / 39.000 / 6.900 (phí trọng lượng tạm 100.000đ). Thêm ca: `final_price` ≤ `user_offer` và hoàn đúng phần chênh lệch.
- [ ] **4.5 Form đặt đơn — phần địa điểm và dịch vụ**: điểm bốc/trả (mở modal 4.3b), **Hoán đổi**, chip khoảng cách, "+ Thêm điểm trả (sắp có)" khóa, dòng **Dịch vụ: {tên} — Đổi** (mở sheet chọn 1 trong 7 dịch vụ, có mô tả). Nút đáy "Chọn điểm bốc & điểm trả" → "Đặt đơn".
- [ ] **4.6 Form đặt đơn — phần chi tiết hàng**: trọng lượng 4 mức (chip + dòng mô tả bên dưới), khối Nơi bốc (số tầng + thang máy), công tắc dỡ hàng → khối Nơi dỡ (số tầng + thang máy), số thợ 1–10, ghi chú cho thợ.
- [ ] **4.7 Form đặt đơn — phần tùy chọn**: Đặt ngay / Đặt lịch (🆕 khóa "Sắp có"), 🆕 bottom sheet Tốc độ nhận đơn + Loại nhà cung cấp (ràng buộc theo số thợ), thẻ "Số tiền bạn trả" ≥ 10.000đ, 4 dòng giá tự tính, chọn Tiền mặt / Ví (🆕 hiện số dư ví; ví không đủ → chặn + gợi ý Nạp tiền + cho đổi sang tiền mặt, xem mục 4).
- [x] **4.8 Form đặt đơn — media**: ảnh ≤ 7 (đếm n/7), video ≤ 2 phút (🆕 hiện `mm:ss`, nút Quay lại / Xóa), xem trước, xóa, 🆕 báo lỗi ảnh tải thất bại. *Đã làm*: `js/ui/order-media.js` chọn file + kiểm tra ≤ 2 phút; form hiện poster, `mm:ss`, **Quay lại** / **Xóa**; ảnh lỗi dòng đỏ; ghi `uploads/` nếu đã chọn thư mục. Desktop = chọn file video.
- [ ] **4.9 Modal xác nhận đặt đơn**: 🆕 bottom sheet (lộ trình + khoảng cách, phương thức, số tiền, dòng "Thanh toán được thu trước khi ghép thợ" (🆕 ✅ **chỉ hiện khi chọn trả bằng Ví**; tiền mặt thì không hiện), nút Hủy / Thanh toán), tạm giữ tiền ví (nếu trả ví), tạo `orders` trạng thái `finding` + `order_events` + 🆕 thông báo "Đơn hàng đã được tạo!"; sau đó chuyển tới `#/orders/:id/quotes` (🆕 khung tối thiểu: đếm ngược, lộ trình, trạng thái rỗng, nút Hủy đơn; phần còn lại làm ở 5.6).

**Demo cuối giai đoạn 4**: khách đặt được một đơn đầy đủ, đơn xuất hiện trong DB với giá và media đúng.

### Giai đoạn 5 — Khu thợ (Vendor)

- [ ] **5.1 Khung app thợ**: bottom tab, trang chủ với công tắc **Sẵn sàng nhận đơn**, thống kê hôm nay.
- [ ] **5.2 Chợ đơn**: danh sách đơn `finding`, lọc tự động theo loại/số thợ/dịch vụ/khu vực, sắp xếp mới nhất/gấp nhất/gần nhất.
- [ ] **5.3 Chi tiết đơn (thợ)**: lộ trình, khoảng cách, thông tin việc, ảnh, video, số tiền khách trả (mức Gấp hiển thị giá hiện tại).
- [ ] **5.4 Báo giá (đơn 1 thợ)**: nhập giá (≤ số tiền khách đặt), ETA, lời nhắn; sửa/rút báo giá.
- [ ] **5.5 Nhận đơn (đơn ≥ 2 thợ)**: nút Nhận đơn (nhập ETA, lời nhắn; giá cố định, không sửa), kiểm tra lại trạng thái đơn trước khi ghi (đơn còn `finding`), 🆕 **nhiều tổ đội cùng nhận được**, mỗi đội 1 đề nghị hiệu lực/đơn, rút được khi chưa được chọn; không còn "ai bấm trước".
- [ ] **5.6 Màn "Đang nhận báo giá" (khách)**: 🆕 thẻ "Còn lại để nhận báo giá" + đồng hồ `mm:ss` đếm ngược từ 30 phút, lộ trình 2 điểm, tiêu đề "Báo giá (n) — thấp đến cao", danh sách báo giá/đề nghị (🆕 đơn nhiều thợ: hiện tên đội, đánh giá, ETA, lời nhắn; đề nghị vượt mức tối đa có nhãn "Vượt mức tối đa +x đ" và nút Chấp nhận / Không — Không thì chọn thợ khác), 🆕 **khách tự chọn thợ mong muốn**; xử lý `accepted/rejected`, đơn → `matched`, hết hạn thì tự hủy; nút "Hủy đơn" đáy màn.
- [ ] **5.7 Báo giá của tôi (thợ)**: 4 tab Chờ chọn / Được chọn / Không được chọn / Hết hạn. 🆕 Gồm cả đề nghị từ Nhận đơn (đơn ≥ 2 thợ).
- [ ] **5.8 Việc của tôi**: nút **Bắt đầu đến** → **Đã đến, bắt đầu bốc** → **Hoàn thành** (ghi chú, ảnh xác nhận tùy chọn), hủy việc có lý do, **Xác nhận đã thu tiền** cho đơn tiền mặt.
- [ ] **5.9 Bot demo và panel `#/sim`**: bot tự báo giá (bật/tắt theo `app_settings`), nút đẩy trạng thái đơn.
- [ ] **5.10 Polling**: khách và thợ tự cập nhật đơn/báo giá mỗi 3–5 giây, dọn timer khi rời màn.

**Demo cuối giai đoạn 5**: mở 2 tab (khách + thợ): khách đặt đơn, thợ báo giá, khách chọn thợ, thợ cập nhật tiến độ tới hoàn thành.

### Giai đoạn 6 — Đơn hàng của khách

- [ ] **6.1 Danh sách đơn**: 🆕 5 tab (Tất cả / Đang tìm thợ / Đang thực hiện / Hoàn thành / Đã hủy, cuộn ngang), 🆕 icon tìm kiếm ở header + ô "Tìm theo mã đơn hoặc địa chỉ…", nhóm theo tháng ("Tháng 10/2026"), thẻ đơn (icon + tên dịch vụ **đúng dịch vụ đã chọn**, nhãn trạng thái, ngày giờ, 2 địa chỉ bốc/dỡ rút gọn, số tiền), nút **Theo dõi** (đơn `finding` → màn Đang nhận báo giá), **Đặt lại**; bấm thẻ → Chi tiết.
- [ ] **6.2 Chi tiết đơn**: 🆕 thẻ đầu (trạng thái, dịch vụ, mã đơn bấm copy, "x giờ trước"), 🆕 nút chia sẻ (→ in/PDF) và bookmark (không chức năng), timeline 5 mốc (ẩn khi hủy; 🆕 đơn hủy hiện dòng "Đơn hàng đã bị hủy"), bản đồ (kéo/phóng to/thu nhỏ; ẩn khi hủy), lộ trình (bốc, dỡ, khoảng cách), thông tin công việc (trọng lượng, tầng bốc + thang máy, cần dỡ hàng, tầng dỡ + thang máy, số thợ, ghi chú), ảnh hàng hóa bấm để phóng to, 🆕 video nếu có, khối Thanh toán (4 dòng giá + **Tổng tiền = số tiền khách trả**), nút đáy theo trạng thái (xem mục 4).
- [ ] **6.3 Hủy đơn**: chọn lý do, hoàn tiền ví đúng quy tắc, ghi `order_events`.
- [ ] **6.4 Đặt lại**: tạo đơn mới điền sẵn từ đơn cũ (🆕 app gốc chưa làm, ta làm tốt hơn).
- [ ] **6.5 In / PDF**: CSS print cho chi tiết đơn (🆕 gắn vào nút chia sẻ).
- [ ] **6.6 Tự hủy hết hạn**: đơn `finding` quá 30 phút thì hủy "Không tìm được thợ".

**Demo cuối giai đoạn 6**: vòng đời đơn nhìn đủ từ phía khách, hủy và đặt lại hoạt động.

### Giai đoạn 7 — Ví, hoa hồng, khuyến mãi

- [ ] **7.1 Ví khách**: 🆕 header "Ví của tôi" + nút đồng hồ (→ lịch sử); thẻ "Số dư khả dụng" có biểu tượng mắt ẩn/hiện + nút "+ Nạp tiền"; dòng ghi chú "Số dư dùng để thanh toán đơn bốc vác"; "Giao dịch gần đây" + "Xem tất cả". Màn **Lịch sử giao dịch**: 🆕 4 tab (Tất cả / Nạp tiền / Thanh toán / Hoàn tiền; Excel mô tả 3 tab, ảnh thật có thêm "Tất cả"), nhóm theo ngày ("Hôm nay"), mỗi dòng: loại giao dịch, giờ, số tiền, trạng thái (đang xử lý = gạch ngang + nhãn cam).
- [ ] **7.2 Nạp tiền giả lập**: thẻ số dư (ẩn/hiện), chip số tiền nhanh (🆕 50.000 / 100.000 / 200.000 / 500.000 / 1.000.000 / 2.000.000), ô nhập số khác, chọn **VNPay (QR / Ngân hàng)** hoặc **Ví MoMo** (🆕 ghi chú phí 0đ), nút "Nạp {số tiền}", màn cổng thanh toán giả, giao dịch pending → success/failed.
- [ ] **7.3 Hold / refund**: nối với đặt đơn, chọn thợ, hủy đơn (kiểm lại bằng test ca: đặt 500k, chọn thợ 400k → hoàn 100k).
- [ ] **7.4 Mã giảm giá**: 🆕 ô nhập "VD: TTVNEW10" + nút Áp dụng, khung cảnh báo vàng (chỉ áp dụng từ 2 thợ), 3 tab Khả dụng / Đã dùng / Hết hạn, thẻ mã (tên, điều kiện "Đơn tối thiểu …", NSD, nhãn "Hết hạn"), trạng thái rỗng; áp dụng cho đơn ≥ 2 thợ, tính giảm trong `pricing.js`.
- [ ] **7.5 Phương thức thanh toán**: mặc định ví (hiện số dư)/tiền mặt, liên kết nguồn nạp (bấm → màn Nạp tiền).
- [ ] **7.6 Hoa hồng khi hoàn thành đơn**: tính `commission_amount`, `vendor_earning`, ghi `vendor_transactions`, trừ hoa hồng với đơn tiền mặt, khóa nhận đơn khi ví âm quá ngưỡng.
- [ ] **7.7 Ví thợ**: số dư, thu nhập theo đơn, hoa hồng đã trừ, lịch sử.
- [ ] **7.8 Rút tiền (thợ)**: form yêu cầu rút, trạng thái, lịch sử.

**Demo cuối giai đoạn 7**: nạp ví, đặt đơn trả ví, hoàn thành đơn thấy hoa hồng và thu nhập thợ đúng số.

### Giai đoạn 8 — Admin nâng cao

- [ ] **8.1 Quản lý khách**: tìm kiếm, hồ sơ, đơn, ví, địa chỉ; khóa/mở; cộng/trừ ví thủ công (bắt buộc lý do); reset thiết bị.
- [ ] **8.2 Quản lý đơn**: lọc theo trạng thái/dịch vụ/ngày, chi tiết, báo giá, timeline.
- [ ] **8.3 Can thiệp đơn**: gán thợ thủ công, đổi trạng thái, hủy và hoàn tiền (đều ghi audit).
- [ ] **8.4 Tài chính**: giao dịch ví, duyệt nạp tiền đang xử lý, **duyệt yêu cầu rút tiền**, đối soát hoa hồng.
- [ ] **8.5 Khuyến mãi**: tạo/sửa/tắt mã, cấp mã cho khách, quản lý banner (upload ảnh, đích).
- [ ] **8.6 Nội dung**: FAQ, 3 tab Điều khoản & Chính sách (có ngày cập nhật), gửi thông báo hệ thống (`broadcasts`).
- [ ] **8.7 Hỗ trợ**: xử lý báo cáo (Mới/Đang xử lý/Đã đóng) kèm phản hồi; ẩn/xóa đánh giá vi phạm.
- [ ] **8.8 Dashboard thật**: đơn hôm nay, GMV, hoa hồng, khách mới, tỉ lệ ghép thành công, đơn không tìm được thợ, biểu đồ ngày/tuần.
- [ ] **8.9 Kiểm tra ma trận quyền**: đăng nhập từng role, xác nhận menu và route đúng quyền.

**Demo cuối giai đoạn 8**: admin xử lý trọn một đơn lỗi, duyệt một yêu cầu rút tiền, dashboard khớp số liệu.

### Giai đoạn 9 — Phụ trợ và hoàn thiện

- [ ] **9.1 Thông báo** (cả 3 vai trò): chuông, 🆕 4 tab Tất cả / Đơn hàng / Khuyến mãi / Hệ thống, 🆕 dòng đếm "N thông báo", nhóm theo ngày ("Hôm nay"), nhãn loại nhỏ (ĐƠN HÀNG…), nút xóa từng dòng, trạng thái rỗng, click vào đơn → chi tiết; sinh thông báo ở các sự kiện đơn (🆕 "Đơn hàng đã được tạo!", "Không tìm được thợ" khi tự hủy…), rút tiền, broadcast. Hiển thị mã đơn ngắn, không hiện UUID.
- [ ] **9.2 Cài đặt thông báo và Cài đặt chung**: toggle thông báo (🆕 Thông báo đơn hàng: cập nhật trạng thái, thợ đang đến…; Khuyến mãi & ưu đãi: mã giảm giá, sự kiện; Thông báo hệ thống: cập nhật, bảo trì) + 🆕 "Âm thanh & rung". **Cài đặt chung**: 🆕 Ngôn ngữ (Tiếng Việt; Tiếng Anh khóa "Sắp có"), Giao diện (Sáng / Tối / Theo hệ thống; Tối làm ở 9.7), nút **Xóa bộ nhớ đệm** (không xóa đăng nhập), **Về TingTingVac** (→ Điều khoản & Chính sách), Đăng xuất.
- [ ] **9.3 Đánh giá**: khách đánh giá đơn hoàn thành (tab Chờ đánh giá/Đã đánh giá); thợ xem và phản hồi.
- [ ] **9.4 Bảo mật và thiết bị đăng nhập**: 🆕 màn Bảo mật có thẻ "trạng thái bảo vệ" (phương thức đăng nhập, ngày tạo tài khoản), tùy chọn Đăng nhập sinh trắc học (Sắp có), Đổi mã PIN (Sắp có), Thiết bị đăng nhập, nút "Đăng xuất khỏi thiết bị này". Màn **Thiết bị đăng nhập**: danh sách phiên, trạng thái hoạt động, dấu tích "Thiết bị này", đăng xuất thiết bị khác (🆕 Excel ghi chú: cần cơ chế quản lý phiên — dùng bảng `sessions`).
- [ ] **9.5 Trợ giúp**: 🆕 màn Trợ giúp & Hỗ trợ có khối **liên hệ** (Gọi tổng đài `tel:`, Chat Zalo OA — Sắp có, Gửi email `mailto:`) và khối **Tự trợ giúp** (Câu hỏi thường gặp, Hướng dẫn đặt đơn → FAQ tab Đặt đơn, Chính sách hoàn tiền → Điều khoản tab hoàn tiền, Báo cáo sự cố); FAQ 4 tab (Đặt đơn / Thanh toán / Ví / Tài khoản) + tìm kiếm + nút "Liên hệ hỗ trợ"; Điều khoản & Chính sách 3 tab (Điều khoản sử dụng / Chính sách bảo mật / Chính sách hoàn tiền) có "cập nhật lần cuối"; gửi và xem **Lịch sử báo cáo** (khách và thợ). 🆕 "Báo cáo sự cố" ở app gốc mở app mail của thiết bị; ta làm form trong app (ghi `reports`) và có thêm liên kết gửi email.
- [ ] **9.6 Hồ sơ thợ**: ảnh, giấy tờ, dịch vụ, khu vực.
- [ ] **9.7 Dark mode**.
- [ ] **9.8 Trạng thái rỗng, lỗi, tải** rà soát toàn bộ màn hình.
- [ ] **9.9 Kiểm thử luồng chính** (liệt kê ở mục 9) và sửa lỗi.
- [ ] **9.10 README**: cách chạy, tài khoản demo, giới hạn bảo mật, giới hạn upload.
- [ ] **🆕 9.11 Đối chiếu với Excel**: đi qua bảng mục 12, mở từng ảnh `docs/reference/` cạnh màn hình tương ứng, ghi chênh lệch còn lại (nhãn chữ, thứ tự, trạng thái nút) và sửa.

---

## 9. Luồng kiểm thử chính (chạy ở 9.9, và sau mỗi giai đoạn nếu liên quan)

1. Khách đăng nhập OTP → onboarding → nạp ví → đặt đơn 1 thợ trả ví → thấy báo giá → chọn thợ → đơn hoàn thành → đánh giá.
2. Admin tạo thợ → thợ đổi mật khẩu → thợ vào chợ đơn → báo giá → được chọn → cập nhật tiến độ → ví thợ nhận tiền sau hoa hồng → thợ rút tiền → admin duyệt.
3. Khách đặt đơn 3 thợ với mã giảm giá → hai tổ đội cùng bấm Nhận đơn → khách thấy cả hai đề nghị và chọn một → đội còn lại chuyển "Không được chọn". 🆕 Biến thể: khách nhập mức tối đa thấp hơn giá tự tính → đề nghị hiện "Vượt mức tối đa" → khách chọn Không → chọn đội còn lại (hoặc Chấp nhận, ví bị tạm giữ thêm phần chênh).
4. Đơn không ai nhận quá 30 phút → tự hủy → hoàn tiền ví.
5. Hủy đơn đã `matched` → hoàn tiền đúng, thông báo gửi đúng người.
6. Admin SUPPORT không vào được cấu hình và tài chính.
7. 🆕 Khách đặt đơn trả tiền mặt → hủy ở màn Đang nhận báo giá → đơn sang tab Đã hủy, nút Đặt lại điền sẵn đúng dữ liệu.
8. 🆕 Khách nhập sai OTP 5 lần → bị khóa tạm; nhập mã giảm giá cho đơn 1 thợ → bị từ chối kèm lý do.

---

## 10. Giả định hiện tại (có thể sửa)

- Hoa hồng mặc định 15%.
- Thợ rút tiền do admin duyệt bằng tay.
- Đơn ≥ 2 thợ: nhiều tổ đội cùng nhận được, khách chọn (🆕 đã chốt, thay cho "ai bấm trước được").
- Tài khoản admin đầu: `admin` / `Admin@12345` (bắt đổi lần đầu).
- Bản đồ dùng Leaflet + OSM thay VietMap cho tới khi có key.
- 🆕 Đơn giá tạm ở mục 4 (Chuyển nhà 50.000; 6 dịch vụ khác 100.000; phí trọng lượng mọi mức 100.000; 15.000 mỗi tầng; 5.000 mỗi km); hệ số tầng và km lấy từ **một** ảnh chụp.
- 🆕 Khu khách bám sát Excel; khu thợ và admin tự thiết kế theo cùng phong cách thị giác.

## 11. Câu hỏi mở

- [x] ~~Nội dung kio-api~~ ✅ đã nhận adapter `KioStore` (ghi chú ở task 1.5). **Quyết định hiện tại: làm trên local trước, chưa ghi KIO.** Còn lại: dán thêm `store.js` của HRM nếu muốn bám đúng giao diện.
- [ ] Có key VietMap không? Nếu có thì thay vào `map-service.js` ở task 4.3.
- [x] ~~Danh sách 7 dịch vụ và bảng giá~~ ✅ 7 dịch vụ từ Excel; giá cơ bản 6 dịch vụ còn lại và phí trọng lượng mọi mức tạm = 100.000đ (mục 4).
- [ ] Danh sách khu vực hoạt động của thợ (quận/huyện hay tỉnh/thành?) để làm bộ lọc ở 3.3 và 5.2. (Địa chỉ trong ảnh đều ở TP.HCM — Thủ Đức, Quận 12, Quận 8.)
- [x] 🆕 ~~Số tiền khách trả~~ ✅ khách nhập số tiền **tối đa**; số tiền thực trả tính từ giá thợ ra + lựa chọn của khách (mục 4).
- [x] 🆕 ~~Ví không đủ số dư~~ ✅ chặn + gợi ý nạp tiền + cho đổi sang tiền mặt (mục 4).
- [x] 🆕 ~~Dòng "thu trước khi ghép thợ"~~ ✅ chỉ hiện khi trả bằng ví.
- [x] 🆕 ~~Giá tự tính > số tiền tối đa~~ ✅ vẫn cho đặt; khách chọn Chấp nhận hoặc Không (rồi chọn thợ khác); xem mục 4 "Loại đơn".
- [ ] 🆕 Số dịch vụ hiển thị ở Trang chủ là 7 ô nhưng ảnh chỉ có 4 + 3 ô; có icon/ảnh gốc cho từng dịch vụ không, hay dùng emoji/SVG tạm?
- [ ] 🆕 Có cần lưu "Lịch sử tìm kiếm" hoặc "Vị trí gần đây" trong modal chọn điểm không (ảnh không cho thấy)?

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
