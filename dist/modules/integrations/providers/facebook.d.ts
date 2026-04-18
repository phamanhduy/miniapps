interface FacebookConfig {
    pageAccessToken?: string;
    pageId?: string;
}
export declare function importFacebookLeads(orgId: string, config: FacebookConfig): Promise<{
    direction: 'import';
    recordCount: number;
    status: 'success' | 'partial' | 'failed';
    errorMessage?: string;
}>;
export {};
//# sourceMappingURL=facebook.d.ts.map