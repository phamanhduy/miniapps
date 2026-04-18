import { db } from '../../shared/database/db.js';
import { appointments } from '../../shared/database/schema.js';
import { eq, and, gte, lte, asc, desc, count } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
const APPOINTMENT_WITH = {
    contact: { columns: { id: true, fullName: true, phone: true, avatarUrl: true } },
    assignedUser: { columns: { id: true, fullName: true } },
};
export async function appointmentRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // ── GET /api/v1/appointments/today — today's appointments ─────────────────
    app.get('/api/v1/appointments/today', async (request, reply) => {
        try {
            const user = request.user;
            const today = new Date();
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
            const items = await db.query.appointments.findMany({
                where: and(eq(appointments.orgId, user.orgId), gte(appointments.appointmentDate, start), lte(appointments.appointmentDate, end)),
                with: APPOINTMENT_WITH,
                orderBy: [asc(appointments.appointmentTime), asc(appointments.appointmentDate)],
            });
            return { appointments: items, total: items.length };
        }
        catch (err) {
            logger.error('[appointments] Today error:', err);
            return reply.status(500).send({ error: 'Failed to fetch today appointments' });
        }
    });
    // ── GET /api/v1/appointments/upcoming — next 7 days ───────────────────────
    app.get('/api/v1/appointments/upcoming', async (request, reply) => {
        try {
            const user = request.user;
            const now = new Date();
            const in7Days = new Date(now);
            in7Days.setDate(in7Days.getDate() + 7);
            const items = await db.query.appointments.findMany({
                where: and(eq(appointments.orgId, user.orgId), gte(appointments.appointmentDate, now), lte(appointments.appointmentDate, in7Days), eq(appointments.status, 'scheduled')),
                with: APPOINTMENT_WITH,
                orderBy: [asc(appointments.appointmentDate), asc(appointments.appointmentTime)],
            });
            return { appointments: items, total: items.length };
        }
        catch (err) {
            logger.error('[appointments] Upcoming error:', err);
            return reply.status(500).send({ error: 'Failed to fetch upcoming appointments' });
        }
    });
    // ── GET /api/v1/appointments — list with filters ──────────────────────────
    app.get('/api/v1/appointments', async (request, reply) => {
        try {
            const user = request.user;
            const { page = '1', limit = '50', status = '', contactId = '', dateFrom = '', dateTo = '', } = request.query;
            let filters = eq(appointments.orgId, user.orgId);
            if (status)
                filters = and(filters, eq(appointments.status, status));
            if (contactId)
                filters = and(filters, eq(appointments.contactId, contactId));
            if (dateFrom)
                filters = and(filters, gte(appointments.appointmentDate, new Date(dateFrom)));
            if (dateTo)
                filters = and(filters, lte(appointments.appointmentDate, new Date(dateTo)));
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const [items, totalResult] = await Promise.all([
                db.query.appointments.findMany({
                    where: filters,
                    with: APPOINTMENT_WITH,
                    orderBy: [desc(appointments.appointmentDate), asc(appointments.appointmentTime)],
                    offset: (pageNum - 1) * limitNum,
                    limit: limitNum,
                }),
                db.select({ value: count() }).from(appointments).where(filters),
            ]);
            return { appointments: items, total: totalResult[0].value, page: pageNum, limit: limitNum };
        }
        catch (err) {
            logger.error('[appointments] List error:', err);
            return reply.status(500).send({ error: 'Failed to fetch appointments' });
        }
    });
    // ── GET /api/v1/appointments/:id — detail ─────────────────────────────────
    app.get('/api/v1/appointments/:id', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const appointment = await db.query.appointments.findFirst({
                where: and(eq(appointments.id, id), eq(appointments.orgId, user.orgId)),
                with: APPOINTMENT_WITH,
            });
            if (!appointment)
                return reply.status(404).send({ error: 'Appointment not found' });
            return appointment;
        }
        catch (err) {
            logger.error('[appointments] Detail error:', err);
            return reply.status(500).send({ error: 'Failed to fetch appointment' });
        }
    });
    // ── POST /api/v1/appointments — create ────────────────────────────────────
    app.post('/api/v1/appointments', async (request, reply) => {
        try {
            const user = request.user;
            const body = request.body;
            if (!body.contactId || !body.appointmentDate) {
                return reply.status(400).send({ error: 'contactId and appointmentDate are required' });
            }
            // Deduplication: prevent same contact + same date within org
            const appointmentDate = new Date(body.appointmentDate);
            const existing = await db.query.appointments.findFirst({
                where: and(eq(appointments.contactId, body.contactId), eq(appointments.appointmentDate, appointmentDate), eq(appointments.orgId, user.orgId)),
            });
            if (existing) {
                return reply.status(409).send({ error: 'Lịch hẹn đã tồn tại cho ngày này' });
            }
            const id = uuidv4();
            await db.insert(appointments).values({
                id,
                orgId: user.orgId,
                contactId: body.contactId,
                assignedUserId: body.assignedUserId ?? user.id,
                appointmentDate,
                appointmentTime: body.appointmentTime,
                type: body.type,
                status: body.status ?? 'scheduled',
                notes: body.notes,
            });
            const appointment = await db.query.appointments.findFirst({
                where: eq(appointments.id, id),
                with: APPOINTMENT_WITH,
            });
            return reply.status(201).send(appointment);
        }
        catch (err) {
            logger.error('[appointments] Create error:', err);
            return reply.status(500).send({ error: 'Failed to create appointment' });
        }
    });
    // ── PUT /api/v1/appointments/:id — update ─────────────────────────────────
    app.put('/api/v1/appointments/:id', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const body = request.body;
            const existing = await db.query.appointments.findFirst({
                where: and(eq(appointments.id, id), eq(appointments.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Appointment not found' });
            await db.update(appointments)
                .set({
                contactId: body.contactId,
                assignedUserId: body.assignedUserId,
                appointmentDate: body.appointmentDate ? new Date(body.appointmentDate) : undefined,
                appointmentTime: body.appointmentTime,
                type: body.type,
                status: body.status,
                notes: body.notes,
            })
                .where(eq(appointments.id, id));
            const updated = await db.query.appointments.findFirst({
                where: eq(appointments.id, id),
                with: APPOINTMENT_WITH,
            });
            return updated;
        }
        catch (err) {
            logger.error('[appointments] Update error:', err);
            return reply.status(500).send({ error: 'Failed to update appointment' });
        }
    });
    // ── DELETE /api/v1/appointments/:id — delete ──────────────────────────────
    app.delete('/api/v1/appointments/:id', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const existing = await db.query.appointments.findFirst({
                where: and(eq(appointments.id, id), eq(appointments.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Appointment not found' });
            await db.delete(appointments).where(eq(appointments.id, id));
            return { success: true };
        }
        catch (err) {
            logger.error('[appointments] Delete error:', err);
            return reply.status(500).send({ error: 'Failed to delete appointment' });
        }
    });
}
//# sourceMappingURL=appointment-routes.js.map