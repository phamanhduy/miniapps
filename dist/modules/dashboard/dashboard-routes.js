import { db } from '../../shared/database/db.js';
import { messages, conversations, appointments, contacts } from '../../shared/database/schema.js';
import { eq, and, gte, lt, lte, gt, count, sql, asc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
// ── Helpers ──────────────────────────────────────────────────────────────────
// Compute today's boundaries in UTC based on VN timezone (UTC+7)
function todayRange() {
    const now = new Date();
    const vnOffset = 7 * 60 * 60 * 1000;
    const vnNow = new Date(now.getTime() + vnOffset);
    const todayVN = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
    const today = new Date(todayVN.getTime() - vnOffset);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    return { today, tomorrow };
}
function weekAgoDate(from) {
    const d = new Date(from);
    d.setDate(d.getDate() - 7);
    return d;
}
// ── Routes ────────────────────────────────────────────────────────────────────
export async function dashboardRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/dashboard/kpi
    app.get('/api/v1/dashboard/kpi', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { today, tomorrow } = todayRange();
            const weekAgo = weekAgoDate(today);
            const [msgTodayRes, unrepliedRes, unreadRes, aptsTodayRes, newContactsRes, totalContactsRes] = await Promise.all([
                db.select({ value: count() })
                    .from(messages)
                    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
                    .where(and(eq(conversations.orgId, orgId), gte(messages.sentAt, today), lt(messages.sentAt, tomorrow))),
                db.select({ value: count() })
                    .from(conversations)
                    .where(and(eq(conversations.orgId, orgId), eq(conversations.isReplied, false), gt(conversations.unreadCount, 0))),
                db.select({ value: count() })
                    .from(conversations)
                    .where(and(eq(conversations.orgId, orgId), gt(conversations.unreadCount, 0))),
                db.select({ value: count() })
                    .from(appointments)
                    .where(and(eq(appointments.orgId, orgId), gte(appointments.appointmentDate, today), lt(appointments.appointmentDate, tomorrow), eq(appointments.status, 'scheduled'))),
                db.select({ value: count() })
                    .from(contacts)
                    .where(and(eq(contacts.orgId, orgId), gte(contacts.createdAt, weekAgo))),
                db.select({ value: count() })
                    .from(contacts)
                    .where(eq(contacts.orgId, orgId)),
            ]);
            return {
                messagesToday: msgTodayRes[0].value,
                messagesUnreplied: unrepliedRes[0].value,
                messagesUnread: unreadRes[0].value,
                appointmentsToday: aptsTodayRes[0].value,
                newContactsThisWeek: newContactsRes[0].value,
                totalContacts: totalContactsRes[0].value,
            };
        }
        catch (err) {
            logger.error('[dashboard] KPI error:', err);
            return reply.status(500).send({ error: 'Failed to fetch KPI data' });
        }
    });
    // GET /api/v1/dashboard/message-volume?from=&to=
    app.get('/api/v1/dashboard/message-volume', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            const to = query.to || new Date().toISOString().split('T')[0];
            // Convert from/to strings to Date objects for filtering
            const fromDate = new Date(from);
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            // In SQLite with Drizzle, we use strftime on the timestamp_ms column
            const rows = await db.select({
                date: sql `strftime('%Y-%m-%d', datetime(${messages.sentAt} / 1000, 'unixepoch'))`.as('date'),
                sent: sql `SUM(CASE WHEN ${messages.senderType} = 'self' THEN 1 ELSE 0 END)`.as('sent'),
                received: sql `SUM(CASE WHEN ${messages.senderType} = 'contact' THEN 1 ELSE 0 END)`.as('received')
            })
                .from(messages)
                .innerJoin(conversations, eq(messages.conversationId, conversations.id))
                .where(and(eq(conversations.orgId, orgId), gte(messages.sentAt, fromDate), lte(messages.sentAt, toDate)))
                .groupBy(sql `date`)
                .orderBy(asc(sql `date`));
            const data = rows.map((r) => ({
                date: r.date,
                sent: Number(r.sent),
                received: Number(r.received),
            }));
            return { data };
        }
        catch (err) {
            logger.error('[dashboard] Message volume error:', err);
            return reply.status(500).send({ error: 'Failed to fetch message volume' });
        }
    });
    // GET /api/v1/dashboard/pipeline — grouped by generic contact status
    app.get('/api/v1/dashboard/pipeline', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const pipeline = await db.select({
                status: contacts.status,
                count: count()
            })
                .from(contacts)
                .where(and(eq(contacts.orgId, orgId), sql `${contacts.status} IS NOT NULL`))
                .groupBy(contacts.status);
            return { data: pipeline.map((p) => ({ status: p.status, count: p.count })) };
        }
        catch (err) {
            logger.error('[dashboard] Pipeline error:', err);
            return reply.status(500).send({ error: 'Failed to fetch pipeline data' });
        }
    });
    // GET /api/v1/dashboard/sources
    app.get('/api/v1/dashboard/sources', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const sourcesRes = await db.select({
                source: contacts.source,
                count: count()
            })
                .from(contacts)
                .where(and(eq(contacts.orgId, orgId), sql `${contacts.source} IS NOT NULL`))
                .groupBy(contacts.source);
            return { data: sourcesRes.map((s) => ({ source: s.source, count: s.count })) };
        }
        catch (err) {
            logger.error('[dashboard] Sources error:', err);
            return reply.status(500).send({ error: 'Failed to fetch source data' });
        }
    });
    // GET /api/v1/dashboard/appointments?from=&to=
    app.get('/api/v1/dashboard/appointments', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            let filters = eq(appointments.orgId, orgId);
            if (query.from)
                filters = and(filters, gte(appointments.appointmentDate, new Date(query.from)));
            if (query.to)
                filters = and(filters, lte(appointments.appointmentDate, new Date(query.to)));
            const stats = await db.select({
                status: appointments.status,
                count: count()
            })
                .from(appointments)
                .where(filters)
                .groupBy(appointments.status);
            return { data: stats.map((s) => ({ status: s.status, count: s.count })) };
        }
        catch (err) {
            logger.error('[dashboard] Appointments error:', err);
            return reply.status(500).send({ error: 'Failed to fetch appointment stats' });
        }
    });
}
//# sourceMappingURL=dashboard-routes.js.map