import { db } from '../../shared/database/db.js';
import { appointments } from '../../shared/database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
export async function contactSubResourceRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // ── GET /api/v1/contacts/:id/appointments — appointments for contact ───────
    app.get('/api/v1/contacts/:id/appointments', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const items = await db.query.appointments.findMany({
                where: and(eq(appointments.contactId, id), eq(appointments.orgId, user.orgId)),
                orderBy: [desc(appointments.appointmentDate)],
                limit: 20,
            });
            return { appointments: items };
        }
        catch (err) {
            logger.error('[contacts] Appointments by contact error:', err);
            return reply.status(500).send({ error: 'Failed to fetch appointments' });
        }
    });
}
//# sourceMappingURL=contact-sub-resource-routes.js.map