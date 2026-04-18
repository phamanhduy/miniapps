export interface FunnelStage {
    status: string;
    count: number;
    rate: number;
}
export interface ConversionFunnelResult {
    stages: FunnelStage[];
    totalContacts: number;
    avgConversionDays: number | null;
}
export declare function getConversionFunnel(orgId: string, from: string, to: string): Promise<ConversionFunnelResult>;
//# sourceMappingURL=conversion-funnel.d.ts.map