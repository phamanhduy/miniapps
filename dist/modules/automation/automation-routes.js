import { db } from '../../shared/database/db.js';
import { automationRules } from '../../shared/database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireRole } from '../auth/role-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
const VALID_TRIGGERS = ['message_received', 'contact_created', 'status_changed'];
export async function automationRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    app.get('/api/v1/automation/rules', async (request) => {
        const user = request.user;
        const rules = await db.query.automationRules.findMany({
            where: eq(automationRules.orgId, user.orgId),
            orderBy: [desc(automationRules.priority), desc(automationRules.createdAt)],
        });
        return { rules };
    });
    app.post('/api/v1/automation/rules', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const user = request.user;
            const body = request.body;
            if (!body.name || typeof body.name !== 'string')
                return reply.status(400).send({ error: 'name is required' });
            if (!body.trigger || !VALID_TRIGGERS.includes(body.trigger))
                return reply.status(400).send({ error: `trigger must be one of: ${VALID_TRIGGERS.join(', ')}` });
            const id = uuidv4();
            await db.insert(automationRules).values({
                id,
                orgId: user.orgId,
                name: body.name,
                description: body.description,
                trigger: body.trigger,
                conditions: Array.isArray(body.conditions) ? body.conditions : [],
                actions: Array.isArray(body.actions) ? body.actions : [],
                enabled: body.enabled ?? true,
                priority: Number(body.priority ?? 0),
            });
            const rule = await db.query.automationRules.findFirst({ where: eq(automationRules.id, id) });
            return reply.status(201).send(rule);
        }
        catch (error) {
            logger.error('[automation] Create rule error:', error);
            return reply.status(500).send({ error: 'Failed to create automation rule' });
        }
    });
    app.put('/api/v1/automation/rules/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const body = request.body;
            if (body.trigger && !VALID_TRIGGERS.includes(body.trigger))
                return reply.status(400).send({ error: `trigger must be one of: ${VALID_TRIGGERS.join(', ')}` });
            const existing = await db.query.automationRules.findFirst({
                where: and(eq(automationRules.id, id), eq(automationRules.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Automation rule not found' });
            await db.update(automationRules)
                .set({
                name: body.name,
                description: body.description,
                trigger: body.trigger,
                conditions: Array.isArray(body.conditions) ? body.conditions : undefined,
                actions: Array.isArray(body.actions) ? body.actions : undefined,
                enabled: body.enabled,
                priority: body.priority !== undefined ? Number(body.priority) : undefined,
                updatedAt: new Date()
            })
                .where(eq(automationRules.id, id));
            const rule = await db.query.automationRules.findFirst({ where: eq(automationRules.id, id) });
            return rule;
        }
        catch (error) {
            logger.error('[automation] Update rule error:', error);
            return reply.status(500).send({ error: 'Failed to update automation rule' });
        }
    });
    app.delete('/api/v1/automation/rules/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const existing = await db.query.automationRules.findFirst({
                where: and(eq(automationRules.id, id), eq(automationRules.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Automation rule not found' });
            await db.delete(automationRules).where(eq(automationRules.id, id));
            return { success: true };
        }
        catch (error) {
            logger.error('[automation] Delete rule error:', error);
            return reply.status(500).send({ error: 'Failed to delete automation rule' });
        }
    });
}
//# sourceMappingURL=automation-routes.js.map