/**
 * auto-tagger.ts — Applies auto-tags to contacts based on lead score and activity.
 * Preserves user-defined tags; removes and replaces auto-tags on each run.
 */
import { db } from '../../shared/database/db.js';
import { contacts, appointments } from '../../shared/database/schema.js';
import { eq, and, gte } from 'drizzle-orm';
const AUTO_TAGS = [
    'hot-lead',
    'warm-lead',
    'cold-lead',
    'inactive-14d',
    'inactive-30d',
    'has-appointment',
];
export async function applyAutoTags(contactId, score, lastActivity) {
    const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, contactId),
        columns: { tags: true },
    });
    const raw = contact?.tags;
    const existingTags = Array.isArray(raw) ? raw : [];
    // Remove all existing auto-tags; keep user-defined tags
    const userTags = existingTags.filter((t) => !AUTO_TAGS.includes(t));
    const newAutoTags = [];
    // Score-based tags
    if (score >= 70)
        newAutoTags.push('hot-lead');
    else if (score >= 40)
        newAutoTags.push('warm-lead');
    else
        newAutoTags.push('cold-lead');
    // Inactivity tags
    if (lastActivity) {
        const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 30)
            newAutoTags.push('inactive-30d');
        else if (daysSince > 14)
            newAutoTags.push('inactive-14d');
    }
    // Future appointment tag
    const futureApt = await db.query.appointments.findFirst({
        where: and(eq(appointments.contactId, contactId), eq(appointments.status, 'scheduled'), gte(appointments.appointmentDate, new Date())),
        columns: { id: true },
    });
    if (futureApt)
        newAutoTags.push('has-appointment');
    // Merge: unique values, user tags first
    const finalTags = [...new Set([...userTags, ...newAutoTags])];
    return finalTags;
}
//# sourceMappingURL=auto-tagger.js.map