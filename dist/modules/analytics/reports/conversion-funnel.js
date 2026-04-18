/**
 * conversion-funnel.ts — Pipeline conversion rates: count per stage + conversion %.
 */
import { db } from '../../../shared/database/db.js';
import { contacts } from '../../../shared/database/schema.js';
import { eq, and, gte, lt, ne, sql, count } from 'drizzle-orm';
const STAGE_ORDER = ['new', 'contacted', 'interested', 'converted', 'lost'];
export async function getConversionFunnel(orgId, from, to) {
    const startDate = new Date(from);
    const endDate = new Date(to);
    endDate.setDate(endDate.getDate() + 1);
    const groups = await db.select({
        status: contacts.status,
        count: count(),
    })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), gte(contacts.createdAt, startDate), lt(contacts.createdAt, endDate), ne(contacts.status, '')))
        .groupBy(contacts.status);
    const countMap = {};
    let total = 0;
    for (const g of groups) {
        const s = g.status ?? 'unknown';
        countMap[s] = g.count;
        total += g.count;
    }
    const stages = STAGE_ORDER.map((status) => ({
        status,
        count: countMap[status] ?? 0,
        rate: total > 0 ? Math.round(((countMap[status] ?? 0) / total) * 1000) / 10 : 0,
    }));
    // Avg days from createdAt to updatedAt for converted contacts
    // In SQLite, dates are stored as timestamps or strings. Drizzle-SQLite-Better-SQLite3 handles them as Date objects.
    // We use strftime or just date difference in seconds
    const avgResult = await db.select({
        avgSeconds: sql `AVG(CAST((julianday(${contacts.updatedAt}) - julianday(${contacts.createdAt})) * 86400 AS REAL))`
    })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.status, 'converted'), gte(contacts.createdAt, startDate), lt(contacts.createdAt, endDate)));
    const avgDays = avgResult[0]?.avgSeconds ? avgResult[0].avgSeconds / 86400 : null;
    return {
        stages,
        totalContacts: total,
        avgConversionDays: avgDays ? Math.round(avgDays * 10) / 10 : null,
    };
}
//# sourceMappingURL=conversion-funnel.js.map