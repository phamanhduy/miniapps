/**
 * appointment-reminder.ts — Cron job that emits Socket.IO reminders
 * for appointments scheduled tomorrow.
 * Runs daily at 08:00 Vietnam time (01:00 UTC).
 */
import cron from 'node-cron';
import { db } from '../../shared/database/db.js';
import { appointments } from '../../shared/database/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
export function startAppointmentReminder(io) {
    // 01:00 UTC = 08:00 Vietnam time (UTC+7)
    cron.schedule('0 1 * * *', async () => {
        logger.info('[reminder] Checking tomorrow appointments...');
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0);
            const endOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);
            const items = await db.query.appointments.findMany({
                where: and(gte(appointments.appointmentDate, startOfDay), lte(appointments.appointmentDate, endOfDay), eq(appointments.status, 'scheduled'), eq(appointments.reminderSent, false)),
                with: {
                    contact: { columns: { fullName: true, phone: true } },
                    assignedUser: { columns: { id: true, fullName: true } },
                },
            });
            for (const apt of items) {
                io.emit('appointment:reminder', {
                    appointmentId: apt.id,
                    contactName: apt.contact.fullName,
                    contactPhone: apt.contact.phone,
                    date: apt.appointmentDate,
                    time: apt.appointmentTime,
                    type: apt.type,
                    assignedUserId: apt.assignedUserId,
                    assignedUserName: apt.assignedUser?.fullName,
                });
                await db.update(appointments)
                    .set({ reminderSent: true, updatedAt: new Date() })
                    .where(eq(appointments.id, apt.id));
            }
            logger.info(`[reminder] Sent ${items.length} reminder(s)`);
        }
        catch (err) {
            logger.error('[reminder] Cron job error:', err);
        }
    });
    logger.info('[reminder] Appointment reminder cron started (daily 01:00 UTC)');
}
//# sourceMappingURL=appointment-reminder.js.map