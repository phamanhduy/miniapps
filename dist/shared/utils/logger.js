/**
 * Minimal structured logger.
 * Prefixes every message with ISO timestamp and level.
 * Debug output is suppressed in production.
 */
export const logger = {
    info: (...args) => console.log(`[${new Date().toISOString()}] [INFO]`, ...args),
    error: (...args) => console.error(`[${new Date().toISOString()}] [ERROR]`, ...args),
    warn: (...args) => console.warn(`[${new Date().toISOString()}] [WARN]`, ...args),
    debug: (...args) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[${new Date().toISOString()}] [DEBUG]`, ...args);
        }
    },
};
//# sourceMappingURL=logger.js.map