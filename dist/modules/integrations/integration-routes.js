import { db } from '../../shared/database/db.js';
import { integrations, syncLogs } from '../../shared/database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { requireRole } from '../auth/role-middleware.js';
import { runSync } from './sync-engine.js';
import { v4 as uuidv4 } from 'uuid';
const VALID_TYPES = ['google_sheets', 'telegram', 'facebook', 'zapier'];
export async function integrationRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/integrations — list all integrations for org
    app.get('/api/v1/integrations', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const list = await db.query.integrations.findMany({
                where: eq(integrations.orgId, orgId),
                orderBy: [desc(integrations.createdAt)],
                with: {
                    syncLogs: {
                        limit: 5,
                        orderBy: [desc(syncLogs.createdAt)],
                    },
                },
            });
            return list;
        }
        catch (err) {
            logger.error('[integrations] GET list error:', err);
            return reply.status(500).send({ error: 'Failed to fetch integrations' });
        }
    });
    // POST /api/v1/integrations — create integration (admin+)
    app.post('/api/v1/integrations', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { type, name, config: cfg, enabled } = request.body;
            if (!type || !VALID_TYPES.includes(type)) {
                return reply.status(400).send({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
            }
            const id = uuidv4();
            await db.insert(integrations).values({
                id,
                orgId,
                type,
                name: name || type,
                config: cfg ?? {},
                enabled: enabled ?? true
            });
            const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, id) });
            return reply.status(201).send(integration);
        }
        catch (err) {
            logger.error('[integrations] POST create error:', err);
            return reply.status(500).send({ error: 'Failed to create integration' });
        }
    });
    // PUT /api/v1/integrations/:id — update integration (admin+)
    app.put('/api/v1/integrations/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const { name, config: cfg, enabled } = request.body;
            const existing = await db.query.integrations.findFirst({
                where: and(eq(integrations.id, id), eq(integrations.orgId, orgId))
            });
            if (!existing)
                return reply.status(404).send({ error: 'Integration not found' });
            await db.update(integrations)
                .set({
                ...(name !== undefined && { name }),
                ...(cfg !== undefined && { config: cfg }),
                ...(enabled !== undefined && { enabled }),
                updatedAt: new Date()
            })
                .where(eq(integrations.id, id));
            const updated = await db.query.integrations.findFirst({ where: eq(integrations.id, id) });
            return updated;
        }
        catch (err) {
            logger.error('[integrations] PUT update error:', err);
            return reply.status(500).send({ error: 'Failed to update integration' });
        }
    });
    // DELETE /api/v1/integrations/:id — remove integration (admin+)
    app.delete('/api/v1/integrations/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const existing = await db.query.integrations.findFirst({
                where: and(eq(integrations.id, id), eq(integrations.orgId, orgId))
            });
            if (!existing)
                return reply.status(404).send({ error: 'Integration not found' });
            await db.delete(integrations).where(eq(integrations.id, id));
            return { success: true };
        }
        catch (err) {
            logger.error('[integrations] DELETE error:', err);
            return reply.status(500).send({ error: 'Failed to delete integration' });
        }
    });
    // POST /api/v1/integrations/:id/sync — trigger manual sync (admin+)
    app.post('/api/v1/integrations/:id/sync', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const integration = await db.query.integrations.findFirst({
                where: and(eq(integrations.id, id), eq(integrations.orgId, orgId))
            });
            if (!integration)
                return reply.status(404).send({ error: 'Integration not found' });
            if (!integration.enabled)
                return reply.status(400).send({ error: 'Integration is disabled' });
            const log = await runSync(integration);
            return log;
        }
        catch (err) {
            logger.error('[integrations] POST sync error:', err);
            return reply.status(500).send({ error: 'Sync failed' });
        }
    });
    // GET /api/v1/integrations/:id/logs — sync history
    app.get('/api/v1/integrations/:id/logs', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const integration = await db.query.integrations.findFirst({
                where: and(eq(integrations.id, id), eq(integrations.orgId, orgId))
            });
            if (!integration)
                return reply.status(404).send({ error: 'Integration not found' });
            const logs = await db.query.syncLogs.findMany({
                where: eq(syncLogs.integrationId, id),
                orderBy: [desc(syncLogs.createdAt)],
                limit: 50,
            });
            return logs;
        }
        catch (err) {
            logger.error('[integrations] GET logs error:', err);
            return reply.status(500).send({ error: 'Failed to fetch sync logs' });
        }
    });
}
//# sourceMappingURL=integration-routes.js.map