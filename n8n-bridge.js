const axios = require('axios');
const appConfig = require('./config');

class N8nBridge {
    constructor() {
        this.port = appConfig.getAppPort();
        this.baseUrl = `http://127.0.0.1:${this.port}/api/v1`;
        this.apiKey = null;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    async getWorkflows() {
        if (!this.apiKey) {
            console.warn('[n8n-bridge] Missing API Key');
            return { success: false, error: 'API Key missing' };
        }
        try {
            const res = await axios.get(`${this.baseUrl}/workflows`, {
                headers: { 'X-N8N-API-KEY': this.apiKey }
            });
            return { success: true, data: res.data.data || res.data || [] };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async executeWorkflow(id, data) {
        if (!this.apiKey) return { success: false, error: 'API Key missing' };
        try {
            const res = await axios.post(`${this.baseUrl}/workflows/${id}/execute`, data, {
                headers: { 'X-N8N-API-KEY': this.apiKey }
            });
            return { success: true, data: res.data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async checkHealth() {
        try {
            const res = await axios.get(`http://127.0.0.1:${this.port}/healthz`, { timeout: 2000 });
            return { success: res.status === 200 };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
}

module.exports = new N8nBridge();
