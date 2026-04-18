/**
 * merge-service.ts — Merges duplicate contacts within an org.
 * Reassigns conversations/appointments to primary, marks secondaries as merged.
 */
import { db } from '../../shared/database/db.js';
import { contacts, conversations, appointments, activityLogs } from '../../shared/database/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
export async function mergeContacts(orgId, userId, primaryId, secondaryIds) {
    // Use synchronous transaction for better-sqlite3
    return await db.transaction(async (tx) => {
        // Fetch primary
        const primary = await tx.query.contacts.findFirst({ where: eq(contacts.id, primaryId) });
        if (!primary)
            throw new Error(`Contact ${primaryId} not found in org`);
        if (primary.orgId !== orgId)
            throw new Error(`Contact ${primaryId} not found in org`);
        if (primary.mergedInto)
            throw new Error(`Contact ${primaryId} already merged`);
        // Fetch secondaries
        const secondaries = await tx.query.contacts.findMany({ where: inArray(contacts.id, secondaryIds) });
        for (const s of secondaries) {
            if (s.orgId !== orgId)
                throw new Error(`Contact ${s.id} not found in org`);
            if (s.mergedInto)
                throw new Error(`Contact ${s.id} already merged`);
        }
        const nullableFields = ['phone', 'email', 'fullName', 'avatarUrl', 'source', 'notes'];
        const mergedScalars = {};
        for (const field of nullableFields) {
            mergedScalars[field] = primary[field] ?? secondaries.find((s) => s[field] != null)?.[field] ?? null;
        }
        // Union-merge tags
        const primaryTags = Array.isArray(primary.tags) ? primary.tags : [];
        const mergedTags = [...primaryTags];
        for (const s of secondaries) {
            const sTags = Array.isArray(s.tags) ? s.tags : [];
            for (const t of sTags) {
                if (!mergedTags.includes(t))
                    mergedTags.push(t);
            }
        }
        // Shallow-merge metadata
        const primaryMeta = (primary.metadata && typeof primary.metadata === 'object' && !Array.isArray(primary.metadata))
            ? primary.metadata
            : {};
        const mergedMeta = {};
        for (const s of secondaries) {
            const sMeta = (s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata))
                ? s.metadata
                : {};
            Object.assign(mergedMeta, sMeta);
        }
        Object.assign(mergedMeta, primaryMeta); // primary wins
        // Reassign conversations and appointments
        tx.update(conversations)
            .set({ contactId: primaryId })
            .where(inArray(conversations.contactId, secondaryIds))
            .run();
        tx.update(appointments)
            .set({ contactId: primaryId })
            .where(inArray(appointments.contactId, secondaryIds))
            .run();
        // Update primary with merged data
        tx.update(contacts)
            .set({ ...mergedScalars, tags: mergedTags, metadata: mergedMeta, updatedAt: new Date() })
            .where(eq(contacts.id, primaryId))
            .run();
        // Mark secondaries as merged
        tx.update(contacts)
            .set({ mergedInto: primaryId, updatedAt: new Date() })
            .where(inArray(contacts.id, secondaryIds))
            .run();
        // Audit log
        tx.insert(activityLogs).values({
            id: uuidv4(),
            orgId,
            userId,
            action: 'contact_merged',
            entityType: 'contact',
            entityId: primaryId,
            details: { secondaryIds },
        }).run();
        const updatedPrimary = await tx.query.contacts.findFirst({ where: eq(contacts.id, primaryId) });
        return updatedPrimary || {};
    });
}
//# sourceMappingURL=merge-service.js.map