
/**
 * Autopilot Mini App Bridge
 * Cung cấp khả năng giao tiếp với App chính
 */
const { ipcRenderer } = require('electron');

window.Autopilot = {
    // Thông tin app
    appId: "zalocrm",
    
    // Gửi log về app chính
    log: (msg) => ipcRenderer.send('mini-app:log:zalocrm', msg),
    
    // Lấy cấu hình hệ thống
    getConfig: () => ipcRenderer.invoke('get-config'),
    
    // Gọi n8n workflow
    callWorkflow: (id, data) => ipcRenderer.invoke('n8n-api-execute', { id, data })
};

console.log("[Bridge] Autopilot Bridge Initialized");
        