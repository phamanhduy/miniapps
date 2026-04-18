/**
 * duplicate-detector.ts — Detects duplicate contacts per org.
 * Groups by phone, zaloUid, or fuzzy name matching.
 */
import { db } from '../../shared/database/db.js';
import { contacts, duplicateGroups } from '../../shared/database/schema.js';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
function levenshteinRatio(a, b) {
    const la = a.length;
    const lb = b.length;
    if (la === 0 && lb === 0)
        return 1;
    if (la === 0 || lb === 0)
        return 0;
    const dp = Array.from({ length: la + 1 }, (_, i) => Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[la][lb] / Math.max(la, lb);
}
function normPhone(phone) {
    return phone.replace(/[\s\-\.]/g, '').toLowerCase();
}
function normName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
async function saveGroup(orgId, contactIds, matchType, confidence) {
    const sorted = [...contactIds].sort();
    const sortedJson = JSON.stringify(sorted);
    // In SQLite, we compare the JSON string
    const existing = await db.query.duplicateGroups.findFirst({
        where: and(eq(duplicateGroups.orgId, orgId), eq(duplicateGroups.resolved, false), sql `${duplicateGroups.contactIds} = ${sortedJson}`),
    });
    if (existing)
        return;
    await db.insert(duplicateGroups).values({
        id: uuidv4(),
        orgId,
        contactIds: sorted,
        matchType,
        confidence
    });
}
export async function detectDuplicates() {
    const orgs = await db.query.organizations.findMany({ columns: { id: true } });
    let totalGroups = 0;
    for (const org of orgs) {
        const orgContacts = await db.query.contacts.findMany({
            where: and(eq(contacts.orgId, org.id), isNull(contacts.mergedInto)),
            columns: { id: true, phone: true, zaloUid: true, fullName: true },
        });
        // Group by normalized phone
        const byPhone = new Map();
        for (const c of orgContacts) {
            if (!c.phone)
                continue;
            const key = normPhone(c.phone);
            if (!byPhone.has(key))
                byPhone.set(key, []);
            byPhone.get(key).push(c.id);
        }
        for (const ids of byPhone.values()) {
            if (ids.length >= 2) {
                await saveGroup(org.id, ids, 'phone', 1.0);
                totalGroups++;
            }
        }
        // Group by exact zaloUid
        const byZalo = new Map();
        for (const c of orgContacts) {
            if (!c.zaloUid)
                continue;
            if (!byZalo.has(c.zaloUid))
                byZalo.set(c.zaloUid, []);
            byZalo.get(c.zaloUid).push(c.id);
        }
        for (const ids of byZalo.values()) {
            if (ids.length >= 2) {
                await saveGroup(org.id, ids, 'zalo_uid', 1.0);
                totalGroups++;
            }
        }
        // Fuzzy name matching — only contacts with no phone AND no zaloUid
        const noIdContacts = orgContacts.filter((c) => !c.phone && !c.zaloUid && !!c.fullName);
        for (let i = 0; i < noIdContacts.length; i++) {
            for (let j = i + 1; j < noIdContacts.length; j++) {
                const nameA = normName(noIdContacts[i].fullName);
                const nameB = normName(noIdContacts[j].fullName);
                const ratio = levenshteinRatio(nameA, nameB);
                if (ratio > 0.9) {
                    await saveGroup(org.id, [noIdContacts[i].id, noIdContacts[j].id], 'name', ratio);
                    totalGroups++;
                }
            }
        }
    }
    logger.info(`[duplicate-detector] Detected ${totalGroups} new group(s) across ${orgs.length} org(s)`);
}
//# sourceMappingURL=duplicate-detector.js.map