/**
 * google-sheets.ts — Export contacts to Google Sheets via Sheets API v4.
 * Config shape: { spreadsheetId: string, apiKey: string, sheetName?: string }
 * Uses simple API key auth for public/shared sheets.
 */
import { db } from '../../../shared/database/db.js';
import { contacts } from '../../../shared/database/schema.js';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../../../shared/utils/logger.js';
export async function syncGoogleSheets(orgId, config) {
    const { spreadsheetId, apiKey, sheetName = 'Contacts' } = config;
    if (!spreadsheetId || !apiKey) {
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: 'Missing spreadsheetId or apiKey' };
    }
    // Fetch org contacts
    const list = await db.query.contacts.findMany({
        where: eq(contacts.orgId, orgId),
        orderBy: [desc(contacts.createdAt)],
        limit: 5000,
    });
    if (list.length === 0) {
        return { direction: 'export', recordCount: 0, status: 'success' };
    }
    // Build rows: header + data
    const header = ['ID', 'Họ tên', 'SĐT', 'Email', 'Nguồn', 'Trạng thái', 'Ghi chú', 'Ngày tạo'];
    const rows = list.map((c) => [
        c.id,
        c.fullName ?? '',
        c.phone ?? '',
        c.email ?? '',
        c.source ?? '',
        c.status ?? '',
        c.notes ?? '',
        c.createdAt?.toISOString() ?? '',
    ]);
    const values = [header, ...rows];
    try {
        const range = `${sheetName}!A1`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${apiKey}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            const text = await response.text();
            logger.error('[google-sheets] API error:', text);
            return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: `Sheets API ${response.status}: ${text.slice(0, 200)}` };
        }
        logger.info(`[google-sheets] Exported ${list.length} contacts to spreadsheet ${spreadsheetId}`);
        return { direction: 'export', recordCount: list.length, status: 'success' };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: msg };
    }
}
//# sourceMappingURL=google-sheets.js.map