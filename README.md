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

- Mặc định: **KIO** (`https://kio.dvqt.vn`), bảng `ttv_` + tên chữ thường không dấu (`ttv_orders`, `ttv_users`, `ttv_meta`…).
- Thêm `?driver=local` để dùng IndexedDB trên máy.

## Tài khoản đầu tiên

`admin` / `Admin@12345` (đổi trong `index.html`), bắt đổi mật khẩu ở lần đăng nhập đầu.

## Giới hạn

Không có server nên kiểm quyền chỉ là rào cản phía trình duyệt, ai mở DevTools đều vượt được. Chỉ phù hợp bản demo. File upload ghi vào `uploads/` trong source (Chrome/Edge qua `http://localhost` hoặc https), DB chỉ lưu `path`.

Kế hoạch triển khai và quy ước: xem `CLAUDE.md`. Ảnh thiết kế tham chiếu: `docs/reference/`.
