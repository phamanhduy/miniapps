interface SheetConfig {
    spreadsheetId?: string;
    apiKey?: string;
    sheetName?: string;
}
export declare function syncGoogleSheets(orgId: string, config: SheetConfig): Promise<{
    direction: 'export';
    recordCount: number;
    status: 'success' | 'partial' | 'failed';
    errorMessage?: string;
}>;
export {};
//# sourceMappingURL=google-sheets.d.ts.map