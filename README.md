# TingTingVac (TTV) — Đặt thợ bốc vác (chỉ frontend)

JS thuần (script thường, không ES module, không build), không backend. Chạy bằng web server tĩnh, mở `index.html` qua http — **không cần Python**.

```
UI (js/app.js + js/screens/*) → js/api/ttv-api.js (nghiệp vụ + quyền) → js/api/store.js → IndexedDB (local) | KIO (js/api/kio-api.js)
```

## Chạy

- Cách 1: `npx serve .` rồi mở địa chỉ in ra (thường `http://localhost:3000`).
- Cách 2: XAMPP — chép thư mục vào `htdocs`, mở `http://localhost/ttv/`.
- Cách 3: VS Code, tiện ích Live Server.

Không mở trực tiếp bằng `file://` (upload và IndexedDB cần http).

## Driver dữ liệu

- Mặc định: **local** (IndexedDB, không đụng KIO).
- Thêm `?driver=kio` để dùng KIO (`https://kio.dvqt.vn`), bảng prefix `ttv_` — chưa bật, sẽ làm ở task 1.5.

## Tài khoản đầu tiên

`admin` / `Admin@12345` (đổi trong `index.html`), bắt đổi mật khẩu ở lần đăng nhập đầu.

## Giới hạn

Không có server nên kiểm quyền chỉ là rào cản phía trình duyệt, ai mở DevTools đều vượt được. Chỉ phù hợp bản demo. File upload ghi vào `uploads/` trong source (Chrome/Edge qua `http://localhost` hoặc https), DB chỉ lưu `path`.

Kế hoạch triển khai và quy ước: xem `CLAUDE.md`. Ảnh thiết kế tham chiếu: `docs/reference/`.

## Kiểm tra task 1.7–1.8

Mở `http://localhost:3000/#/sim/upload` bằng Chrome/Edge. Chọn thư mục gốc có quyền ghi; ứng dụng tạo `uploads/` bên trong rồi lưu ảnh theo `uploads/{ownerId}/{loại}/{tên-ngẫu-nhiên}.{ext}`. Ảnh được nén trước khi ghi. Video có thể kiểm tra thời lượng tối đa 120 giây. Trang demo cũng kiểm tra định dạng tiền/ngày, thời gian tương đối, che số điện thoại, mã đơn và ghi audit log. File System Access API yêu cầu localhost hoặc HTTPS; dữ liệu audit và các đường dẫn có thể lưu trong DB nhưng việc ghi file thực tế phụ thuộc quyền trình duyệt.
