import { db } from '../../shared/database/db.js';
import { appSettings, contacts, conversations, messages, appointments, zaloAccounts } from '../../shared/database/schema.js';
import { eq, and, or, like, desc, gte, lte, sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
// ── API key auth middleware ────────────────────────────────────────────────────
async function apiKeyAuth(request, reply) {
    const apiKey = request.headers['x-api-key'];
    if (!apiKey)
        return reply.status(401).send({ error: 'API key required' });
    const setting = await db.query.appSettings.findFirst({
        where: and(eq(appSettings.settingKey, 'public_api_key'), eq(appSettings.valuePlain, apiKey)),
    });
    if (!setting)
        return reply.status(401).send({ error: 'Invalid API key' });
    request.orgId = setting.orgId;
}
// ── Route registration ────────────────────────────────────────────────────────
export async function publicApiRoutes(app) {
    app.addHook('preHandler', apiKeyAuth);
    // ── Contacts ─────────────────────────────────────────────────────────────
    app.get('/api/public/contacts', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const { search = '', status = '', limit = '20' } = request.query;
            let filters = eq(contacts.orgId, orgId);
            if (status)
                filters = and(filters, eq(contacts.status, status));
            if (search) {
                const pattern = `%${search}%`;
                filters = and(filters, or(like(contacts.fullName, pattern), like(contacts.phone, pattern), like(contacts.email, pattern)));
            }
            const list = await db.query.contacts.findMany({
                where: filters,
                columns: {
                    id: true, fullName: true, phone: true, email: true,
                    source: true, status: true, notes: true, tags: true,
                    createdAt: true, updatedAt: true,
                },
                orderBy: [desc(contacts.updatedAt)],
                limit: Math.min(parseInt(limit) || 20, 100),
            });
            return { contacts: list };
        }
        catch (err) {
            logger.error('[public-api] GET /contacts error:', err);
            return reply.status(500).send({ error: 'Failed to fetch contacts' });
        }
    });
    app.get('/api/public/contacts/:id', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const { id } = request.params;
            const contact = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, id), eq(contacts.orgId, orgId)),
                with: {
                    appointments: {
                        orderBy: [desc(appointments.appointmentDate)],
                        limit: 5
                    }
                }
            });
            if (!contact)
                return reply.status(404).send({ error: 'Contact not found' });
            // Compute conversation count manually since Drizzle doesn't have _count select like Prisma
            const convCount = await db.select({ value: sql `count(*)` }).from(conversations).where(eq(conversations.contactId, id));
            return { ...contact, _count: { conversations: convCount[0].value } };
        }
        catch (err) {
            logger.error('[public-api] GET /contacts/:id error:', err);
            return reply.status(500).send({ error: 'Failed to fetch contact' });
        }
    });
    app.post('/api/public/contacts', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const body = request.body;
            if (!body?.fullName && !body?.phone) {
                return reply.status(400).send({ error: 'fullName or phone is required' });
            }
            const id = uuidv4();
            await db.insert(contacts).values({
                id,
                orgId,
                fullName: body.fullName,
                phone: body.phone,
                email: body.email,
                source: body.source,
                status: body.status ?? 'new',
                notes: body.notes,
                tags: body.tags ?? [],
            });
            const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
            return reply.status(201).send(contact);
        }
        catch (err) {
            logger.error('[public-api] POST /contacts error:', err);
            return reply.status(500).send({ error: 'Failed to create contact' });
        }
    });
    app.put('/api/public/contacts/:id', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const { id } = request.params;
            const body = request.body;
            const existing = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, id), eq(contacts.orgId, orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Contact not found' });
            await db.update(contacts)
                .set({
                fullName: body.fullName,
                phone: body.phone,
                email: body.email,
                source: body.source,
                status: body.status,
                notes: body.notes,
                tags: body.tags,
                updatedAt: new Date()
            })
                .where(eq(contacts.id, id));
            const updated = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
            return updated;
        }
        catch (err) {
            logger.error('[public-api] PUT /contacts/:id error:', err);
            return reply.status(500).send({ error: 'Failed to update contact' });
        }
    });
    // ── Conversations ─────────────────────────────────────────────────────────
    app.get('/api/public/conversations', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const { limit = '20' } = request.query;
            const list = await db.query.conversations.findMany({
                where: eq(conversations.orgId, orgId),
                columns: {
                    id: true, threadType: true, externalThreadId: true,
                    lastMessageAt: true, unreadCount: true, isReplied: true,
                },
                with: {
                    contact: { columns: { id: true, fullName: true, phone: true, avatarUrl: true } }
                },
                orderBy: [desc(conversations.lastMessageAt)],
                limit: Math.min(parseInt(limit) || 20, 100),
            });
            return { conversations: list };
        }
        catch (err) {
            logger.error('[public-api] GET /conversations error:', err);
            return reply.status(500).send({ error: 'Failed to fetch conversations' });
        }
    });
    app.get('/api/public/conversations/:id/messages', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const { id } = request.params;
            const { limit = '50' } = request.query;
            const conv = await db.query.conversations.findFirst({
                where: and(eq(conversations.id, id), eq(conversations.orgId, orgId)),
                columns: { id: true }
            });
            if (!conv)
                return reply.status(404).send({ error: 'Conversation not found' });
            const list = await db.query.messages.findMany({
                where: and(eq(messages.conversationId, id), eq(messages.isDeleted, false)),
                orderBy: [desc(messages.sentAt)],
                limit: Math.min(parseInt(limit) || 50, 200),
                columns: {
                    id: true, senderType: true, senderName: true,
                    content: true, contentType: true, sentAt: true, attachments: true,
                },
            });
            return { messages: list };
        }
        catch (err) {
            logger.error('[public-api] GET /conversations/:id/messages error:', err);
            return reply.status(500).send({ error: 'Failed to fetch messages' });
        }
    });
    // ── Appointments ──────────────────────────────────────────────────────────
    app.get('/api/public/appointments', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const { from, to } = request.query;
            let filters = eq(appointments.orgId, orgId);
            if (from)
                filters = and(filters, gte(appointments.appointmentDate, new Date(from)));
            if (to)
                filters = and(filters, lte(appointments.appointmentDate, new Date(to)));
            const list = await db.query.appointments.findMany({
                where: filters,
                with: {
                    contact: { columns: { id: true, fullName: true, phone: true } }
                },
                orderBy: [desc(appointments.appointmentDate)],
                limit: 100,
            });
            return { appointments: list };
        }
        catch (err) {
            logger.error('[public-api] GET /appointments error:', err);
            return reply.status(500).send({ error: 'Failed to fetch appointments' });
        }
    });
    app.post('/api/public/appointments', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const body = request.body;
            if (!body?.contactId || !body?.appointmentDate) {
                return reply.status(400).send({ error: 'contactId and appointmentDate are required' });
            }
            const contact = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, body.contactId), eq(contacts.orgId, orgId)),
                columns: { id: true }
            });
            if (!contact)
                return reply.status(404).send({ error: 'Contact not found' });
            const id = uuidv4();
            await db.insert(appointments).values({
                id,
                orgId,
                contactId: body.contactId,
                appointmentDate: new Date(body.appointmentDate),
                appointmentTime: body.appointmentTime,
                type: body.type,
                notes: body.notes,
            });
            const appointment = await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
            return reply.status(201).send(appointment);
        }
        catch (err) {
            logger.error('[public-api] POST /appointments error:', err);
            return reply.status(500).send({ error: 'Failed to create appointment' });
        }
    });
    // ── Messages send ─────────────────────────────────────────────────────────
    app.post('/api/public/messages/send', async (request, reply) => {
        try {
            const orgId = request.orgId;
            const body = request.body;
            if (!body?.zaloAccountId || !body?.threadId || !body?.content) {
                return reply.status(400).send({ error: 'zaloAccountId, threadId, and content are required' });
            }
            // Verify account belongs to org
            const account = await db.query.zaloAccounts.findFirst({
                where: and(eq(zaloAccounts.id, body.zaloAccountId), eq(zaloAccounts.orgId, orgId)),
                columns: { id: true, status: true },
            });
            if (!account)
                return reply.status(404).send({ error: 'Zalo account not found' });
            if (account.status !== 'connected') {
                return reply.status(422).send({ error: 'Zalo account is not connected' });
            }
            // Dynamically import zaloPool to avoid circular deps
            const { zaloPool } = await import('../zalo/zalo-pool.js');
            const api = zaloPool.getApi(body.zaloAccountId);
            if (!api)
                return reply.status(422).send({ error: 'Zalo account not active in pool' });
            const threadType = body.threadType === 'group' ? 1 : 0;
            await api.sendMessage(body.content, body.threadId, threadType);
            return { success: true };
        }
        catch (err) {
            logger.error('[public-api] POST /messages/send error:', err);
            return reply.status(500).send({ error: 'Failed to send message' });
        }
    });
}
//# sourceMappingURL=public-api-routes.js.map