declare class ZaloRateLimiter {
    private dailyCounts;
    private recentSends;
    /** Check if sending is allowed for accountId */
    checkLimits(orgId: string, accountId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /** Record a successful send for rate tracking */
    recordSend(accountId: string): void;
    getDailyCount(accountId: string): number;
}
export declare const zaloRateLimiter: ZaloRateLimiter;
export {};
//# sourceMappingURL=zalo-rate-limiter.d.ts.map