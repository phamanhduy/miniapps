/**
 * zalo-rate-limiter.ts — Per-account rate limiting to prevent Zalo from blocking accounts.
 * Tracks daily send counts and burst windows.
 */
declare class ZaloRateLimiter {
    private dailyCounts;
    private recentSends;
    /** Check if sending is allowed for accountId */
    checkLimits(accountId: string): {
        allowed: boolean;
        reason?: string;
    };
    /** Record a successful send for rate tracking */
    recordSend(accountId: string): void;
    getDailyCount(accountId: string): number;
}
export declare const zaloRateLimiter: ZaloRateLimiter;
export {};
//# sourceMappingURL=zalo-rate-limiter.d.ts.map