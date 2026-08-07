# Autopilot Landing Page - Developer Guide

Hướng dẫn này dành cho các nhà phát triển muốn tạo hoặc tùy chỉnh các Landing Page động trong hệ thống Autopilot.

## 📂 Cấu trúc thư mục một Template
Mỗi template nằm trong một thư mục riêng biệt tại `C:\Autopilot_Data\Templates\{tên-template}`:
- `index.html`: Giao diện chính của Landing Page.
- `script.js`: Logic xử lý phía người dùng (Frontend).
- `style.css`: Quản lý giao diện, màu sắc.
- `handler.js`: **Backend Logic** (Xử lý API, Lưu Database, Chạy lệnh PC).
- `bridge.js`: Thư viện kết nối Frontend với Backend (Tự động tạo ra).

---

## 🚀 Backend Logic (`handler.js`)
Đây là trái tim của template, chạy trên môi trường Node.js phía Server.

### Tham số đầu vào:
```javascript
module.exports = (router, db, bridge, log) => {
    // router: Đối tượng Express Router để tạo API endpoints.
    // db: Truy cập SQLite qua db.instance
    // bridge: Kết nối với n8n engine.
    // log: Ghi log lên giao diện App (info, error, success, warn).
};
```

### Ví dụ xử lý lưu Lead:
```javascript
router.post('/submit', async (req, res) => {
    const { email, topic } = req.body;
    log.info(`Nhận email mới: ${email}`);
    
    try {
        db.instance.prepare("INSERT INTO leads (email) VALUES (?)").run(email);
        log.success("Đã ghi vào Database!");
        res.json({ success: true });
    } catch (e) {
        log.error("Lỗi SQL: " + e.message);
        res.status(500).send(e.message);
    }
});
```

---

## 🛢️ Cơ sở dữ liệu (SQLite)
Bạn có toàn quyền sử dụng SQL thuần. Đối tượng `db.instance` là một instance của `better-sqlite3`.
- Tạo bảng: `db.instance.exec("CREATE TABLE IF NOT EXISTS ...")`
- Truy vấn: `db.instance.prepare("SELECT * FROM ...").all()`

---

## ⚡ Hot-Reload (Không cần restart)
Hệ thống có cơ chế tự động nhận diện thay đổi:
1. **Frontend**: Sửa HTML/CSS/JS -> Chỉ cần nhấn **F5** trên trình duyệt.
2. **Backend**: Sửa `handler.js` -> Hệ thống tự xóa cache và nạp lại API sau **0.3 giây**. Bạn sẽ thấy thông báo nạp lại trong bảng Logs của App.

---

## 🤝 Cầu nối Frontend (`bridge.js`)
Trong file `index.html`, hãy nhúng `bridge.js`. Bạn có các hàm helper:
- `n8nBridge.submitLead(data)`: Gửi dữ liệu khách hàng nhanh.
- `n8nBridge.apiCall(path, method, data)`: Gọi các API tùy chỉnh bạn viết trong `handler.js`.

---
*Chúc bạn tạo ra những Landing Page bùng nổ!*
