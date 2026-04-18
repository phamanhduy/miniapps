import { db } from '../../../shared/database/db.js';
import { users, contacts } from '../../../shared/database/schema.js';
import { eq, and } from 'drizzle-orm';
export async function assignUserAction(contactId, userId, orgId) {
    const user = await db.query.users.findFirst({
        where: and(eq(users.id, userId), eq(users.orgId, orgId)),
        columns: { id: true }
    });
    if (!user)
        return null;
    return db.update(contacts)
        .set({ assignedUserId: userId, updatedAt: new Date() })
        .where(eq(contacts.id, contactId));
}
//# sourceMappingURL=assign-user-action.js.map