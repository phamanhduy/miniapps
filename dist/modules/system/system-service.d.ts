export declare class SystemService {
    private cache;
    getSetting(orgId: string, key: string, defaultValue: any, type?: 'string' | 'number' | 'boolean'): Promise<any>;
    saveSetting(orgId: string, key: string, value: any): Promise<void>;
    getZaloLimits(orgId: string): Promise<{
        bulkMessageDelay: any;
        dailyLimit: any;
        burstLimit: any;
    }>;
    getAllSettings(orgId: string): Promise<{
        zalo: {
            bulkMessageDelay: any;
            dailyLimit: any;
            burstLimit: any;
        };
        ai: {
            enabled: any;
            defaultProvider: any;
            defaultModel: any;
            apiKeyOpenAI: any;
            apiKeyGemini: any;
            apiKeyAnthropic: any;
            apiKeyQwen: any;
            apiKeyKimi: any;
            systemPrompt: any;
        };
        integrations: {
            webhookUrl: any;
            publicApiKey: any;
            autoReconnect: any;
        };
        branding: {
            appName: any;
            orgName: any;
            logoUrl: any;
            maxUploadSize: any;
        };
    }>;
    saveAllSettings(orgId: string, data: any): Promise<void>;
}
export declare const systemService: SystemService;
//# sourceMappingURL=system-service.d.ts.map