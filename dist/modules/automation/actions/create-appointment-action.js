import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../shared/database/db.js';
import { appointments } from '../../../shared/database/schema.js';
import { eq } from 'drizzle-orm';
export async function createAppointmentAction(input) {
    const offsetHours = Number.isFinite(input.offsetHours) ? Number(input.offsetHours) : 24;
    const appointmentDate = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    const id = uuidv4();
    await db.insert(appointments).values({
        id,
        orgId: input.orgId,
        contactId: input.contactId,
        assignedUserId: input.assignedUserId ?? null,
        appointmentDate,
        type: input.typeLabel ?? 'automation_follow_up',
        status: 'scheduled',
        notes: input.notes ?? 'Tạo tự động bởi workflow automation',
    });
    return await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
}
//# sourceMappingURL=create-appointment-action.js.map