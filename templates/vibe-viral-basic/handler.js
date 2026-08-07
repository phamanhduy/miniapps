//  * @param { TemplateService } db - Đối tượng quản lý SQLite(Dùng db.instance)
//     * @param { Bridge } bridge - Đối tượng kết nối n8n
//         * @param { Logger } log - Đối tượng ghi log lên giao diện App(info, error, success)
//             */
module.exports = (router, db, bridge, log) => {

    // 1. Tự khởi tạo bảng dữ liệu cho riêng mình
    if (db.instance) {
        log.info("Đang kiểm tra và khởi tạo cấu trúc bảng SQLite...");
        db.instance.exec(`
            CREATE TABLE IF NOT EXISTS leads_vibe_viral (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                customer_name TEXT,
                customer_phone TEXT,
                customer_email TEXT,
                raw_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    /**
     * API: Gửi thông tin khách hàng (Lead)
     * POST /:username/vibe-viral-basic/api/submit
     */
    router.post('/submit', async (req, res) => {
        const { username } = req.params;
        const { name, phone, email } = req.body;

        if (!db.instance) return res.status(500).json({ success: false, error: "Database offline" });

        log.info(`Nhận dữ liệu từ ${username}:`, JSON.stringify({ name, phone, email }));

        try {
            // Thực thi SQL thuần để lưu dữ liệu
            const stmt = db.instance.prepare(`
                INSERT INTO leads_vibe_viral (username, customer_name, customer_phone, customer_email, raw_data) 
                VALUES (?, ?, ?, ?, ?)
            `);

            const info = stmt.run(username || 'anonymous', name, phone, email, JSON.stringify(req.body));

            res.json({
                success: true,
                message: "Đã lưu thông tin thành công!",
                leadId: info.lastInsertRowid
            });
        } catch (e) {
            log.error(`[SQL Error] ${e.message}`);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    /**
     * API: Lấy danh sách khách hàng của template này
     * GET /:username/vibe-viral-basic/api/leads
     */
    router.get('/leads', (req, res) => {
        if (!db.instance) return res.status(500).json({ success: false });

        try {
            const rows = db.instance.prepare('SELECT * FROM leads_vibe_viral ORDER BY created_at DESC').all();
            res.json(rows);
        } catch (e) {
            res.json([]);
        }
    });
};
