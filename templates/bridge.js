/**
 * n8n-bridge-client.js
 * Cầu nối giữa Template HTML và n8n-bridge (Backend)
 */
const n8nBridge = {
    /**
     * Gửi yêu cầu thực thi workflow hoặc gửi dữ liệu về n8n
     * @param {Object} options - { webhookPath, data, workflowId }
     */
    async send(options) {
        const { webhookPath, data, workflowId } = options;
        
        // Tùy thuộc vào việc template được gọi qua Tunnel hay trực tiếp
        // Ở đây chúng ta giả định nó gọi về cùng một Host serving template
        let endpoint = '';
        const payload = {
            timestamp: new Date().toISOString(),
            data: data || {}
        };

        if (webhookPath) {
            // Gửi trực tiếp qua webhook proxy
            endpoint = `/api/bridge/webhook/${webhookPath.replace(/^\//, '')}`;
        } else if (workflowId) {
            // Kích hoạt workflow qua ID (với sự cho phép của App)
            endpoint = `/api/bridge/execute/${workflowId}`;
        } else {
            throw new Error('Thiếu thông tin đích (webhookPath hoặc workflowId)');
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[Bridge] Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Gửi dữ liệu về API Handler nội bộ của Template
     * URL: /:username/:templateName/api/:path
     */
    async apiCall(path, options = {}) {
        const { method = 'POST', data = {} } = options;
        
        // Tự động xác định đường dẫn API dựa trên URL hiện tại của trình duyệt
        // Ví dụ: /duy/vibe-viral-basic/ -> /duy/vibe-viral-basic/api/[path]
        const currentPath = window.location.pathname.replace(/\/$/, '');
        const endpoint = `${currentPath}/api/${path.replace(/^\//, '')}`;

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: method !== 'GET' ? JSON.stringify(data) : undefined
            });
            return await response.json();
        } catch (error) {
            console.error('[Bridge API] Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Helper nhanh để gửi Lead (Khách hàng tiềm năng)
     */
    async submitLead(data) {
        return this.apiCall('submit', { data });
    },

    /**
     * Lấy trạng thái hệ thống (tùy chọn)
     */
    async getStatus() {
        try {
            const response = await fetch('/api/bridge/status');
            return await response.json();
        } catch (e) {
            return { success: false };
        }
    }
};

// Export để dùng trong các script khác
window.n8nBridge = n8nBridge;
