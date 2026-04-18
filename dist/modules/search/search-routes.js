import { db } from '../../shared/database/db.js';
import { contacts, messages, appointments, conversations } from '../../shared/database/schema.js';
import { eq, and, or, like, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
export async function searchRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    app.get('/api/v1/search', async (request) => {
        const user = request.user;
        const { q = '' } = request.query;
        if (!q || q.length < 2)
            return { contacts: [], messages: [], appointments: [] };
        const searchTerm = q.trim();
        const pattern = `%${searchTerm}%`;
        const [contactResults, messageResults, appointmentResults] = await Promise.all([
            db.query.contacts.findMany({
                where: and(eq(contacts.orgId, user.orgId), or(like(contacts.fullName, pattern), like(contacts.phone, pattern), like(contacts.notes, pattern))),
                columns: { id: true, fullName: true, phone: true, diseaseCode: true, diseaseName: true },
                limit: 10,
            }),
            db.query.messages.findMany({
                where: and(like(messages.content, pattern), 
                // Filter by orgId through conversation join logic
                sql `EXISTS (SELECT 1 FROM ${conversations} WHERE ${conversations.id} = ${messages.conversationId} AND ${conversations.orgId} = ${user.orgId})`),
                with: {
                    conversation: {
                        columns: { id: true },
                        with: {
                            contact: { columns: { fullName: true } }
                        }
                    }
                },
                orderBy: [desc(messages.sentAt)],
                limit: 10,
            }),
            db.query.appointments.findMany({
                where: and(eq(appointments.orgId, user.orgId), or(like(appointments.notes, pattern), 
                // Subquery for contact name match since Drizzle findMany 'where' doesn't support easy join filtering in SQLite yet
                sql `EXISTS (SELECT 1 FROM ${contacts} WHERE ${contacts.id} = ${appointments.contactId} AND ${contacts.fullName} LIKE ${pattern})`)),
                with: {
                    contact: { columns: { fullName: true } }
                },
                limit: 10,
            }),
        ]);
        return { contacts: contactResults, messages: messageResults, appointments: appointmentResults };
    });
}
//# sourceMappingURL=search-routes.js.map