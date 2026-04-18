import ExcelJS from 'exceljs';
import { db } from '../../shared/database/db.js';
import { messages, conversations, contacts, appointments } from '../../shared/database/schema.js';
import { eq, and, gte, lte, count, sql, asc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { buildMessagesSheet, buildContactsSheet, buildAppointmentsSheet, } from './excel-sheet-builders.js';
function defaultDateRange() {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    return { from, to };
}
export async function reportRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/reports/messages?from=&to=
    app.get('/api/v1/reports/messages', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from: defaultFrom, to: defaultTo } = defaultDateRange();
            const from = query.from || defaultFrom;
            const to = query.to || defaultTo;
            const fromDate = new Date(from);
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            const rows = await db.select({
                date: sql `strftime('%Y-%m-%d', datetime(${messages.sentAt} / 1000, 'unixepoch'))`.as('date'),
                sent: sql `SUM(CASE WHEN ${messages.senderType} = 'self' THEN 1 ELSE 0 END)`.as('sent'),
                received: sql `SUM(CASE WHEN ${messages.senderType} = 'contact' THEN 1 ELSE 0 END)`.as('received'),
                total: count()
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
                total: Number(r.total),
            }));
            return { from, to, data };
        }
        catch (err) {
            logger.error('[reports] Messages error:', err);
            return reply.status(500).send({ error: 'Failed to fetch message report' });
        }
    });
    // GET /api/v1/reports/contacts?from=&to= — contacts by status distribution
    app.get('/api/v1/reports/contacts', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from: defaultFrom, to: defaultTo } = defaultDateRange();
            const from = query.from || defaultFrom;
            const to = query.to || defaultTo;
            const fromDate = new Date(from);
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            const [newPerDay, statusDist] = await Promise.all([
                db.select({
                    date: sql `strftime('%Y-%m-%d', datetime(${contacts.createdAt} / 1000, 'unixepoch'))`.as('date'),
                    count: count()
                })
                    .from(contacts)
                    .where(and(eq(contacts.orgId, orgId), gte(contacts.createdAt, fromDate), lte(contacts.createdAt, toDate)))
                    .groupBy(sql `date`)
                    .orderBy(asc(sql `date`)),
                db.select({
                    status: contacts.status,
                    count: count()
                })
                    .from(contacts)
                    .where(and(eq(contacts.orgId, orgId), sql `${contacts.status} IS NOT NULL`))
                    .groupBy(contacts.status),
            ]);
            return {
                from,
                to,
                newPerDay: newPerDay.map((r) => ({
                    date: r.date,
                    count: Number(r.count),
                })),
                byStatus: statusDist.map((s) => ({
                    status: s.status,
                    count: s.count,
                })),
            };
        }
        catch (err) {
            logger.error('[reports] Contacts error:', err);
            return reply.status(500).send({ error: 'Failed to fetch contact report' });
        }
    });
    // GET /api/v1/reports/appointments?from=&to=
    app.get('/api/v1/reports/appointments', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from: defaultFrom, to: defaultTo } = defaultDateRange();
            const from = query.from || defaultFrom;
            const to = query.to || defaultTo;
            const fromDate = new Date(from);
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            const [byStatus, byType] = await Promise.all([
                db.select({
                    status: appointments.status,
                    count: count()
                })
                    .from(appointments)
                    .where(and(eq(appointments.orgId, orgId), gte(appointments.appointmentDate, fromDate), lte(appointments.appointmentDate, toDate)))
                    .groupBy(appointments.status),
                db.select({
                    type: appointments.type,
                    count: count()
                })
                    .from(appointments)
                    .where(and(eq(appointments.orgId, orgId), gte(appointments.appointmentDate, fromDate), lte(appointments.appointmentDate, toDate)))
                    .groupBy(appointments.type),
            ]);
            return {
                from,
                to,
                byStatus: byStatus.map((s) => ({ status: s.status, count: s.count })),
                byType: byType.map((t) => ({ type: t.type, count: t.count })),
            };
        }
        catch (err) {
            logger.error('[reports] Appointments error:', err);
            return reply.status(500).send({ error: 'Failed to fetch appointment report' });
        }
    });
    // GET /api/v1/reports/export?type=messages&from=&to=
    app.get('/api/v1/reports/export', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from: defaultFrom, to: defaultTo } = defaultDateRange();
            const type = query.type || 'messages';
            const from = query.from || defaultFrom;
            const to = query.to || defaultTo;
            const workbook = new ExcelJS.Workbook();
            if (type === 'messages') {
                await buildMessagesSheet(workbook, orgId, from, to);
            }
            else if (type === 'contacts') {
                await buildContactsSheet(workbook, orgId, from, to);
            }
            else if (type === 'appointments') {
                await buildAppointmentsSheet(workbook, orgId, from, to);
            }
            else {
                return reply.status(400).send({ error: 'Invalid export type. Use: messages, contacts, appointments' });
            }
            const buffer = await workbook.xlsx.writeBuffer();
            reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            reply.header('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
            return reply.send(Buffer.from(buffer));
        }
        catch (err) {
            logger.error('[reports] Export error:', err);
            return reply.status(500).send({ error: 'Failed to export report' });
        }
    });
}
//# sourceMappingURL=report-routes.js.map