import { db } from '../../shared/database/db.js';
import { messageTemplates } from '../../shared/database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireRole } from '../auth/role-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
export async function templateRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    app.get('/api/v1/automation/templates', async (request) => {
        const user = request.user;
        const list = await db.query.messageTemplates.findMany({
            where: eq(messageTemplates.orgId, user.orgId),
            orderBy: [desc(messageTemplates.createdAt)],
        });
        return { templates: list };
    });
    app.post('/api/v1/automation/templates', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const user = request.user;
            const body = request.body;
            if (!body.name || typeof body.name !== 'string')
                return reply.status(400).send({ error: 'name is required' });
            if (!body.content || typeof body.content !== 'string')
                return reply.status(400).send({ error: 'content is required' });
            const id = uuidv4();
            await db.insert(messageTemplates).values({
                id,
                orgId: user.orgId,
                name: body.name,
                content: body.content,
                category: body.category || null,
            });
            const template = await db.query.messageTemplates.findFirst({ where: eq(messageTemplates.id, id) });
            return reply.status(201).send(template);
        }
        catch (error) {
            logger.error('[automation] Create template error:', error);
            return reply.status(500).send({ error: 'Failed to create message template' });
        }
    });
    app.put('/api/v1/automation/templates/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const body = request.body;
            const existing = await db.query.messageTemplates.findFirst({
                where: and(eq(messageTemplates.id, id), eq(messageTemplates.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Message template not found' });
            await db.update(messageTemplates)
                .set({
                name: body.name,
                content: body.content,
                category: body.category || null,
                updatedAt: new Date()
            })
                .where(eq(messageTemplates.id, id));
            const template = await db.query.messageTemplates.findFirst({ where: eq(messageTemplates.id, id) });
            return template;
        }
        catch (error) {
            logger.error('[automation] Update template error:', error);
            return reply.status(500).send({ error: 'Failed to update message template' });
        }
    });
    app.delete('/api/v1/automation/templates/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const existing = await db.query.messageTemplates.findFirst({
                where: and(eq(messageTemplates.id, id), eq(messageTemplates.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Message template not found' });
            await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
            return { success: true };
        }
        catch (error) {
            logger.error('[automation] Delete template error:', error);
            return reply.status(500).send({ error: 'Failed to delete message template' });
        }
    });
}
//# sourceMappingURL=template-routes.js.map