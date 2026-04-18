import { db } from '../../shared/database/db.js';
import { organizations } from '../../shared/database/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from './auth-middleware.js';
import { requireRole } from './role-middleware.js';
import { logger } from '../../shared/utils/logger.js';
export async function orgRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/organization — get current org info
    app.get('/api/v1/organization', async (request, reply) => {
        const user = request.user;
        try {
            const org = await db.query.organizations.findFirst({
                where: eq(organizations.id, user.orgId),
            });
            if (!org)
                return reply.status(404).send({ error: 'Organization not found' });
            return org;
        }
        catch (error) {
            logger.error('Failed to fetch organization:', error);
            return reply.status(500).send({ error: 'Failed to fetch organization' });
        }
    });
    // PUT /api/v1/organization — update org name (owner only)
    app.put('/api/v1/organization', { preHandler: requireRole('owner') }, async (request, reply) => {
        const user = request.user;
        const { name } = request.body;
        if (!name?.trim())
            return reply.status(400).send({ error: 'Tên tổ chức là bắt buộc' });
        try {
            const [org] = await db.update(organizations)
                .set({
                name: name.trim(),
                updatedAt: new Date()
            })
                .where(eq(organizations.id, user.orgId))
                .returning();
            logger.info(`Organization updated: ${org.name} by ${user.email}`);
            return org;
        }
        catch (error) {
            logger.error('Failed to update organization:', error);
            return reply.status(500).send({ error: 'Failed to update organization' });
        }
    });
}
//# sourceMappingURL=org-routes.js.map