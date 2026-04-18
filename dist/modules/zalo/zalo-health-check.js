/**
 * zalo-health-check.ts — Cron-based health monitor for Zalo account connections.
 * Runs every 5 minutes to detect disconnected accounts and auto-reconnect them.
 * Also runs a daily session refresh at 04:00 UTC to keep cookies fresh.
 */
import cron from 'node-cron';
import { zaloPool } from './zalo-pool.js';
import { db } from '../../shared/database/db.js';
import { zaloAccounts } from '../../shared/database/schema.js';
import { isNotNull } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
export function startZaloHealthCheck() {
    // Every 5 minutes: check all accounts with saved sessions
    cron.schedule('*/5 * * * *', async () => {
        try {
            const accounts = await db.query.zaloAccounts.findMany({
                where: isNotNull(zaloAccounts.sessionData),
                columns: { id: true, displayName: true, sessionData: true },
            });
            for (const acc of accounts) {
                const status = zaloPool.getStatus(acc.id);
                if (status !== 'connected' && status !== 'connecting' && status !== 'qr_pending') {
                    const session = acc.sessionData;
                    if (session?.imei) {
                        logger.info(`[health-check] Reconnecting ${acc.displayName || acc.id}...`);
                        zaloPool.reconnect(acc.id, session).catch((err) => {
                            logger.warn(`[health-check] Reconnect failed for ${acc.id}:`, err);
                        });
                    }
                }
            }
        }
        catch (err) {
            logger.error('[health-check] Error during health check:', err);
        }
    });
    // Daily at 04:00 UTC (11:00 AM VN): refresh all sessions to keep cookies alive
    cron.schedule('0 4 * * *', async () => {
        logger.info('[health-check] Daily session refresh starting...');
        try {
            const accounts = await db.query.zaloAccounts.findMany({
                where: isNotNull(zaloAccounts.sessionData),
                columns: { id: true, sessionData: true },
            });
            for (const acc of accounts) {
                const session = acc.sessionData;
                if (session?.imei) {
                    // Disconnect then reconnect to force cookie refresh
                    zaloPool.disconnect(acc.id);
                    await new Promise((r) => setTimeout(r, 5000));
                    zaloPool.reconnect(acc.id, session).catch((err) => {
                        logger.warn(`[health-check] Daily refresh failed for ${acc.id}:`, err);
                    });
                }
                // Stagger reconnects by 10 seconds per account to avoid rate limits
                await new Promise((r) => setTimeout(r, 10000));
            }
        }
        catch (err) {
            logger.error('[health-check] Error during daily refresh:', err);
        }
    });
    logger.info('[health-check] Zalo health check started (every 5 min + daily refresh at 04:00 UTC)');
}
//# sourceMappingURL=zalo-health-check.js.map