export interface DailyResponseTime {
    date: string;
    avgSeconds: number;
}
export interface UserResponseTime {
    userId: string;
    fullName: string;
    avgSeconds: number;
}
export interface ResponseTimeResult {
    daily: DailyResponseTime[];
    overall: number | null;
    byUser: UserResponseTime[];
}
export declare function getResponseTimeAnalysis(orgId: string, from: string, to: string): Promise<ResponseTimeResult>;
//# sourceMappingURL=response-time.d.ts.map