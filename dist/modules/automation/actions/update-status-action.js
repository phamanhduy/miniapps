import { db } from '../../../shared/database/db.js';
import { contacts } from '../../../shared/database/schema.js';
import { eq } from 'drizzle-orm';
export async function updateStatusAction(contactId, status) {
    return db.update(contacts)
        .set({ status, updatedAt: new Date() })
        .where(eq(contacts.id, contactId));
}
//# sourceMappingURL=update-status-action.js.map