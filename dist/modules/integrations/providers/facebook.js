/**
 * facebook.ts — Import leads from Facebook Page via Graph API.
 * Config shape: { pageAccessToken: string, pageId: string }
 * Fetches conversations from the page and creates contacts.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../shared/database/db.js';
import { contacts } from '../../../shared/database/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../../shared/utils/logger.js';
export async function importFacebookLeads(orgId, config) {
    const { pageAccessToken, pageId } = config;
    if (!pageAccessToken || !pageId) {
        return { direction: 'import', recordCount: 0, status: 'failed', errorMessage: 'Missing pageAccessToken or pageId' };
    }
    try {
        // Fetch page conversations
        const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=participants&access_token=${pageAccessToken}&limit=100`;
        const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) {
            const body = await response.text();
            logger.error('[facebook] Graph API error:', body);
            return { direction: 'import', recordCount: 0, status: 'failed', errorMessage: `Facebook API ${response.status}: ${body.slice(0, 200)}` };
        }
        const data = (await response.json());
        const conversationsList = data.data ?? [];
        let imported = 0;
        for (const conv of conversationsList) {
            const participants = conv.participants?.data ?? [];
            for (const p of participants) {
                // Skip the page itself
                if (p.id === pageId)
                    continue;
                // Upsert contact by source + metadata (using json_extract for SQLite)
                const existing = await db.query.contacts.findFirst({
                    where: and(eq(contacts.orgId, orgId), sql `json_extract(${contacts.metadata}, '$.facebook_id') = ${p.id}`),
                });
                if (!existing) {
                    await db.insert(contacts).values({
                        id: uuidv4(),
                        orgId,
                        fullName: p.name,
                        source: 'Facebook',
                        sourceDate: new Date(),
                        firstContactDate: new Date(),
                        status: 'new',
                        metadata: { facebook_id: p.id },
                    });
                    imported++;
                }
            }
        }
        logger.info(`[facebook] Imported ${imported} leads from page ${pageId}`);
        return { direction: 'import', recordCount: imported, status: imported > 0 ? 'success' : 'partial' };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { direction: 'import', recordCount: 0, status: 'failed', errorMessage: msg };
    }
}
//# sourceMappingURL=facebook.js.map