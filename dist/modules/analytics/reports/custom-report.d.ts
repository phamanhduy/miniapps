export interface ReportConfig {
    metrics: string[];
    groupBy: 'day' | 'week' | 'month' | 'user' | 'source';
    dateRange: {
        from: string;
        to: string;
    };
    filters?: {
        userId?: string;
        source?: string;
        status?: string;
    };
}
export interface CustomReportResult {
    labels: string[];
    datasets: {
        metric: string;
        data: number[];
    }[];
}
export declare function executeCustomReport(orgId: string, config: ReportConfig): Promise<CustomReportResult>;
//# sourceMappingURL=custom-report.d.ts.map