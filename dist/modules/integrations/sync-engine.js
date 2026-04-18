/**
 * sync-engine.ts — Orchestrates sync execution for any integration type.
 * Delegates to provider-specific handlers and logs results.
 */
import { db } from '../../shared/database/db.js';
import { integrations, syncLogs } from '../../shared/database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { syncGoogleSheets } from './providers/google-sheets.js';
import { sendTelegramNotification } from './providers/telegram-bot.js';
import { importFacebookLeads } from './providers/facebook.js';
import { triggerZapierWebhook } from './providers/zapier-webhook.js';
import { v4 as uuidv4 } from 'uuid';
export async function runSync(integration) {
    let result;
    try {
        const cfg = integration.config;
        switch (integration.type) {
            case 'google_sheets':
                result = await syncGoogleSheets(integration.orgId, cfg);
                break;
            case 'telegram':
                result = await sendTelegramNotification(integration.orgId, cfg);
                break;
            case 'facebook':
                result = await importFacebookLeads(integration.orgId, cfg);
                break;
            case 'zapier':
                result = await triggerZapierWebhook(integration.orgId, cfg);
                break;
            default:
                result = { direction: 'export', recordCount: 0, status: 'failed', errorMessage: `Unknown type: ${integration.type}` };
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[sync-engine] ${integration.type} sync failed:`, msg);
        result = { direction: 'export', recordCount: 0, status: 'failed', errorMessage: msg };
    }
    // Persist sync log
    try {
        const logId = uuidv4();
        await db.insert(syncLogs).values({
            id: logId,
            integrationId: integration.id,
            direction: result.direction,
            recordCount: result.recordCount,
            status: result.status,
            errorMessage: result.errorMessage ?? null,
        });
        // Update lastSyncAt
        await db.update(integrations)
            .set({ lastSyncAt: new Date(), updatedAt: new Date() })
            .where(eq(integrations.id, integration.id));
        return await db.query.syncLogs.findFirst({ where: eq(syncLogs.id, logId) });
    }
    catch (dbErr) {
        logger.error(`[sync-engine] Failed to persist sync log:`, dbErr);
        // Return result info even if log persistence failed
        return { ...result, integrationId: integration.id };
    }
}
//# sourceMappingURL=sync-engine.js.map