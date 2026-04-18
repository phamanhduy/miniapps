import { db } from '../../shared/database/db.js';
import { appSettings } from '../../shared/database/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { emitWebhook } from './webhook-service.js';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
export async function webhookSettingsRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/settings/webhook — retrieve current webhook config
    app.get('/api/v1/settings/webhook', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const [urlSetting, secretSetting] = await Promise.all([
                db.query.appSettings.findFirst({ where: and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, 'webhook_url')) }),
                db.query.appSettings.findFirst({ where: and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, 'webhook_secret')) }),
            ]);
            return {
                url: urlSetting?.valuePlain ?? null,
                // Mask secret — show only last 4 chars
                secret: secretSetting?.valuePlain
                    ? `${'*'.repeat(Math.max(0, secretSetting.valuePlain.length - 4))}${secretSetting.valuePlain.slice(-4)}`
                    : null,
            };
        }
        catch (err) {
            logger.error('[webhook-settings] GET error:', err);
            return reply.status(500).send({ error: 'Failed to fetch webhook settings' });
        }
    });
    // PUT /api/v1/settings/webhook — save webhook URL and secret
    app.put('/api/v1/settings/webhook', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { url, secret } = request.body;
            await Promise.all([
                upsertSetting(orgId, 'webhook_url', url ?? ''),
                secret !== undefined ? upsertSetting(orgId, 'webhook_secret', secret) : Promise.resolve(),
            ]);
            return { success: true };
        }
        catch (err) {
            logger.error('[webhook-settings] PUT error:', err);
            return reply.status(500).send({ error: 'Failed to save webhook settings' });
        }
    });
    // POST /api/v1/settings/webhook/test — deliver a test event to configured URL
    app.post('/api/v1/settings/webhook/test', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const configSetting = await db.query.appSettings.findFirst({
                where: and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, 'webhook_url'))
            });
            if (!configSetting?.valuePlain) {
                return reply.status(400).send({ error: 'No webhook URL configured' });
            }
            await emitWebhook(orgId, 'webhook.test', { message: 'Test event from Zalo CRM', orgId });
            return { success: true, sentTo: configSetting.valuePlain };
        }
        catch (err) {
            logger.error('[webhook-settings] Test error:', err);
            return reply.status(500).send({ error: 'Failed to send test webhook' });
        }
    });
    // POST /api/v1/settings/api-key/generate — generate new public API key
    app.post('/api/v1/settings/api-key/generate', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const newKey = `zcrm_${crypto.randomBytes(24).toString('hex')}`;
            await upsertSetting(orgId, 'public_api_key', newKey);
            return { key: newKey };
        }
        catch (err) {
            logger.error('[webhook-settings] Generate API key error:', err);
            return reply.status(500).send({ error: 'Failed to generate API key' });
        }
    });
    // GET /api/v1/settings/api-key — retrieve masked API key
    app.get('/api/v1/settings/api-key', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const setting = await db.query.appSettings.findFirst({
                where: and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, 'public_api_key'))
            });
            if (!setting?.valuePlain)
                return { key: null };
            const k = setting.valuePlain;
            // Show prefix + first 8 chars + mask + last 4 chars
            const masked = k.length > 12 ? `${k.slice(0, 12)}${'*'.repeat(k.length - 16)}${k.slice(-4)}` : `${k.slice(0, 4)}****`;
            return { key: masked };
        }
        catch (err) {
            logger.error('[webhook-settings] GET API key error:', err);
            return reply.status(500).send({ error: 'Failed to fetch API key' });
        }
    });
}
// ── Helper ────────────────────────────────────────────────────────────────────
async function upsertSetting(orgId, settingKey, value) {
    const existing = await db.query.appSettings.findFirst({
        where: and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, settingKey))
    });
    if (existing) {
        await db.update(appSettings)
            .set({ valuePlain: value, updatedAt: new Date() })
            .where(and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, settingKey)));
    }
    else {
        await db.insert(appSettings).values({
            id: uuidv4(),
            orgId,
            settingKey,
            valuePlain: value
        });
    }
}
//# sourceMappingURL=webhook-settings-routes.js.map