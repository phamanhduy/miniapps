/**
 * zapier-webhook.ts — Trigger Zapier webhooks with CRM data.
 * Config shape: { webhookUrl: string, events?: string[] }
 * Sends latest contacts as payload to Zapier catch hook.
 */
import { db } from '../../../shared/database/db.js';
import { contacts } from '../../../shared/database/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { logger } from '../../../shared/utils/logger.js';
export async function triggerZapierWebhook(orgId, config) {
    const { webhookUrl } = config;
    if (!webhookUrl) {
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: 'Missing webhookUrl' };
    }
    // SSRF guard: only allow HTTPS to non-private hosts
    try {
        const parsed = new URL(webhookUrl);
        if (parsed.protocol !== 'https:') {
            return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: 'webhookUrl must use HTTPS' };
        }
        const blocked = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;
        if (blocked.test(parsed.hostname)) {
            return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: 'webhookUrl target is not allowed' };
        }
    }
    catch {
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: 'Invalid webhookUrl' };
    }
    try {
        // Send recent contacts created in last 24h
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const list = await db.query.contacts.findMany({
            where: and(eq(contacts.orgId, orgId), gte(contacts.createdAt, since)),
            orderBy: [desc(contacts.createdAt)],
            limit: 100,
        });
        const payload = {
            event: 'contacts.sync',
            orgId,
            timestamp: new Date().toISOString(),
            count: list.length,
            contacts: list.map((c) => ({
                id: c.id,
                fullName: c.fullName,
                phone: c.phone,
                email: c.email,
                source: c.source,
                status: c.status,
                createdAt: c.createdAt?.toISOString() ?? '',
            })),
        };
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            const body = await response.text();
            logger.error('[zapier-webhook] Error:', body);
            return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: `Zapier ${response.status}: ${body.slice(0, 200)}` };
        }
        logger.info(`[zapier-webhook] Sent ${list.length} contacts to Zapier`);
        return { direction: 'export', recordCount: list.length, status: 'success' };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: msg };
    }
}
//# sourceMappingURL=zapier-webhook.js.map