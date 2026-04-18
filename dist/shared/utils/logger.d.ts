/**
 * Minimal structured logger.
 * Prefixes every message with ISO timestamp and level.
 * Debug output is suppressed in production.
 */
export declare const logger: {
    info: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
};
//# sourceMappingURL=logger.d.ts.map