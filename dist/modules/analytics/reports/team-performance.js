/**
 * team-performance.ts — Per-user metrics: messages sent, contacts converted,
 * appointments completed, avg response time.
 */
import { db } from '../../../shared/database/db.js';
import { users, contacts, messages, conversations, appointments, dailyMessageStats } from '../../../shared/database/schema.js';
import { eq, and, gte, lt, inArray, sql, count } from 'drizzle-orm';
export async function getTeamPerformance(orgId, from, to) {
    const startDate = new Date(from);
    const endDate = new Date(to);
    endDate.setDate(endDate.getDate() + 1);
    // Get all active users in org
    const orgUsersList = await db.query.users.findMany({
        where: and(eq(users.orgId, orgId), eq(users.isActive, true)),
        columns: { id: true, fullName: true },
    });
    if (!orgUsersList.length)
        return { users: [] };
    const userIds = orgUsersList.map((u) => u.id);
    // Parallel queries
    const [msgRows, convertedRows, aptRows, rtRows] = await Promise.all([
        // Messages sent per user (replied_by_user_id)
        db.select({
            userId: messages.repliedByUserId,
            cnt: count(),
        })
            .from(messages)
            .innerJoin(conversations, eq(conversations.id, messages.conversationId))
            .where(and(eq(conversations.orgId, orgId), eq(messages.senderType, 'self'), isNotNull(messages.repliedByUserId), inArray(messages.repliedByUserId, userIds), gte(messages.sentAt, startDate), lt(messages.sentAt, endDate)))
            .groupBy(messages.repliedByUserId),
        // Contacts converted per user
        db.select({
            assignedUserId: contacts.assignedUserId,
            cnt: count(),
        })
            .from(contacts)
            .where(and(eq(contacts.orgId, orgId), eq(contacts.status, 'converted'), isNotNull(contacts.assignedUserId), inArray(contacts.assignedUserId, userIds), gte(contacts.updatedAt, startDate), lt(contacts.updatedAt, endDate)))
            .groupBy(contacts.assignedUserId),
        // Appointments completed per user
        db.select({
            assignedUserId: appointments.assignedUserId,
            cnt: count(),
        })
            .from(appointments)
            .where(and(eq(appointments.orgId, orgId), eq(appointments.status, 'completed'), isNotNull(appointments.assignedUserId), inArray(appointments.assignedUserId, userIds), gte(appointments.appointmentDate, startDate), lt(appointments.appointmentDate, endDate)))
            .groupBy(appointments.assignedUserId),
        // Avg response time from DailyMessageStat
        db.select({
            userId: dailyMessageStats.userId,
            avgRt: sql `AVG(${dailyMessageStats.avgResponseTimeSeconds})`.as('avgRt')
        })
            .from(dailyMessageStats)
            .where(and(eq(dailyMessageStats.orgId, orgId), isNotNull(dailyMessageStats.userId), inArray(dailyMessageStats.userId, userIds), gte(dailyMessageStats.statDate, startDate), lt(dailyMessageStats.statDate, endDate)))
            .groupBy(dailyMessageStats.userId),
    ]);
    // Build lookup maps
    const msgMap = new Map(msgRows.map((r) => [r.userId, r.cnt]));
    const convMap = new Map(convertedRows.map((r) => [r.assignedUserId, r.cnt]));
    const aptMap = new Map(aptRows.map((r) => [r.assignedUserId, r.cnt]));
    const rtMap = new Map(rtRows.map((r) => [r.userId, r.avgRt]));
    const resultUsers = orgUsersList.map((u) => ({
        userId: u.id,
        fullName: u.fullName,
        messagesSent: msgMap.get(u.id) ?? 0,
        contactsConverted: convMap.get(u.id) ?? 0,
        appointmentsCompleted: aptMap.get(u.id) ?? 0,
        avgResponseTime: rtMap.get(u.id) ?? null,
    }));
    // Sort by contactsConverted desc
    resultUsers.sort((a, b) => b.contactsConverted - a.contactsConverted);
    return { users: resultUsers };
}
// Helper for isNotNull inside the batch above if not imported
import { isNotNull } from 'drizzle-orm';
//# sourceMappingURL=team-performance.js.map