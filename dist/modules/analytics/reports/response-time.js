/**
 * response-time.ts — Average response time analysis from DailyMessageStat.
 * Daily trend, overall avg, and per-user breakdown.
 */
import { db } from '../../../shared/database/db.js';
import { dailyMessageStats, users } from '../../../shared/database/schema.js';
import { eq, and, gte, lte, isNotNull, sql, asc } from 'drizzle-orm';
export async function getResponseTimeAnalysis(orgId, from, to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const [dailyRows, overallRows, userRows] = await Promise.all([
        // Daily avg
        db.select({
            statDate: dailyMessageStats.statDate,
            avgRt: sql `AVG(${dailyMessageStats.avgResponseTimeSeconds})`.as('avgRt')
        })
            .from(dailyMessageStats)
            .where(and(eq(dailyMessageStats.orgId, orgId), gte(dailyMessageStats.statDate, fromDate), lte(dailyMessageStats.statDate, toDate), isNotNull(dailyMessageStats.avgResponseTimeSeconds)))
            .groupBy(dailyMessageStats.statDate)
            .orderBy(asc(dailyMessageStats.statDate)),
        // Overall avg
        db.select({
            avgRt: sql `AVG(${dailyMessageStats.avgResponseTimeSeconds})`
        })
            .from(dailyMessageStats)
            .where(and(eq(dailyMessageStats.orgId, orgId), gte(dailyMessageStats.statDate, fromDate), lte(dailyMessageStats.statDate, toDate), isNotNull(dailyMessageStats.avgResponseTimeSeconds))),
        // Per-user avg
        db.select({
            userId: dailyMessageStats.userId,
            fullName: users.fullName,
            avgRt: sql `AVG(${dailyMessageStats.avgResponseTimeSeconds})`.as('avgRt')
        })
            .from(dailyMessageStats)
            .innerJoin(users, eq(users.id, dailyMessageStats.userId))
            .where(and(eq(dailyMessageStats.orgId, orgId), gte(dailyMessageStats.statDate, fromDate), lte(dailyMessageStats.statDate, toDate), isNotNull(dailyMessageStats.avgResponseTimeSeconds)))
            .groupBy(dailyMessageStats.userId, users.fullName)
            .orderBy(asc(sql `avgRt`)),
    ]);
    return {
        daily: dailyRows.map((r) => ({
            date: typeof r.statDate === 'string' ? r.statDate : r.statDate.toISOString().split('T')[0],
            avgSeconds: Math.round(r.avgRt),
        })),
        overall: overallRows[0]?.avgRt ? Math.round(overallRows[0].avgRt) : null,
        byUser: userRows.map((r) => ({
            userId: r.userId,
            fullName: r.fullName,
            avgSeconds: Math.round(r.avgRt),
        })),
    };
}
//# sourceMappingURL=response-time.js.map