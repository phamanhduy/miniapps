interface ZapierConfig {
    webhookUrl?: string;
}
export declare function triggerZapierWebhook(orgId: string, config: ZapierConfig): Promise<{
    direction: 'export';
    recordCount: number;
    status: 'success' | 'failed';
    errorMessage?: string;
}>;
export {};
//# sourceMappingURL=zapier-webhook.d.ts.map