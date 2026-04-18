/**
 * lead-scoring.ts — Computes lead scores for contacts.
 * Score factors: recent messages, scheduled appointments, status, last activity.
 */
import { db } from '../../shared/database/db.js';
import { contacts, conversations, messages, appointments } from '../../shared/database/schema.js';
import { eq, and, gte, desc, inArray, count, isNull } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { applyAutoTags } from './auto-tagger.js';
export async function computeLeadScore(contactId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Count messages in last 7 days via conversations linked to contact
    const contactConvs = await db.query.conversations.findMany({
        where: eq(conversations.contactId, contactId),
        columns: { id: true },
    });
    const convIds = contactConvs.map((c) => c.id);
    let recentMessages = 0;
    if (convIds.length > 0) {
        const res = await db.select({ value: count() })
            .from(messages)
            .where(and(inArray(messages.conversationId, convIds), gte(messages.sentAt, sevenDaysAgo)));
        recentMessages = res[0].value;
    }
    // Check for upcoming scheduled appointment
    const futureAppointment = await db.query.appointments.findFirst({
        where: and(eq(appointments.contactId, contactId), eq(appointments.status, 'scheduled'), gte(appointments.appointmentDate, now)),
        columns: { appointmentDate: true },
    });
    const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, contactId),
        columns: { status: true, updatedAt: true },
    });
    // Latest message sentAt
    let latestMsgSentAt = null;
    if (convIds.length > 0) {
        const latestMsg = await db.query.messages.findFirst({
            where: inArray(messages.conversationId, convIds),
            orderBy: [desc(messages.sentAt)],
            columns: { sentAt: true },
        });
        if (latestMsg)
            latestMsgSentAt = latestMsg.sentAt;
    }
    // Compute lastActivity = max of: latest message, latest appointment, updatedAt
    const candidates = [contact?.updatedAt ?? now];
    if (latestMsgSentAt)
        candidates.push(latestMsgSentAt);
    if (futureAppointment)
        candidates.push(futureAppointment.appointmentDate);
    const lastActivity = new Date(Math.max(...candidates.map((d) => d.getTime())));
    let score = 0;
    // +10 per message in 7d, cap at +40
    score += Math.min(recentMessages * 10, 40);
    // +20 if future scheduled appointment
    if (futureAppointment)
        score += 20;
    // +30 if status = 'interested'
    if (contact?.status === 'interested')
        score += 30;
    // Recency penalty
    const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 30)
        score -= 20;
    else if (daysSinceActivity > 14)
        score -= 10;
    // Clamp 0..100
    return Math.max(0, Math.min(100, score));
}
export async function computeAllLeadScores() {
    const activeContacts = await db.query.contacts.findMany({
        where: isNull(contacts.mergedInto),
        columns: { id: true, updatedAt: true },
    });
    let updatedCount = 0;
    const now = new Date();
    for (const contact of activeContacts) {
        const score = await computeLeadScore(contact.id);
        // Determine lastActivity for auto-tagger
        const contactConvs = await db.query.conversations.findMany({
            where: eq(conversations.contactId, contact.id),
            columns: { id: true },
        });
        const convIds = contactConvs.map((c) => c.id);
        let latestMsgSentAt = null;
        if (convIds.length > 0) {
            const latestMsg = await db.query.messages.findFirst({
                where: inArray(messages.conversationId, convIds),
                orderBy: [desc(messages.sentAt)],
                columns: { sentAt: true },
            });
            if (latestMsg)
                latestMsgSentAt = latestMsg.sentAt;
        }
        const latestApt = await db.query.appointments.findFirst({
            where: and(eq(appointments.contactId, contact.id), gte(appointments.appointmentDate, now)),
            orderBy: [desc(appointments.appointmentDate)],
            columns: { appointmentDate: true },
        });
        const candidates = [contact.updatedAt ?? now];
        if (latestMsgSentAt)
            candidates.push(latestMsgSentAt);
        if (latestApt)
            candidates.push(latestApt.appointmentDate);
        const lastActivity = new Date(Math.max(...candidates.map((d) => d.getTime())));
        const tags = await applyAutoTags(contact.id, score, lastActivity);
        await db.update(contacts)
            .set({ leadScore: score, lastActivity, tags, updatedAt: new Date() })
            .where(eq(contacts.id, contact.id));
        updatedCount++;
    }
    logger.info(`[lead-scoring] Updated scores for ${updatedCount} contact(s)`);
}
//# sourceMappingURL=lead-scoring.js.map