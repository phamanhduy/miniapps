/**
 * telegram-bot.ts — Send CRM notifications via Telegram Bot API.
 * Config shape: { botToken: string, chatId: string }
 */
import { db } from '../../../shared/database/db.js';
import { contacts, messages, appointments, conversations } from '../../../shared/database/schema.js';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { logger } from '../../../shared/utils/logger.js';
export async function sendTelegramNotification(orgId, config) {
    const { botToken, chatId } = config;
    if (!botToken || !chatId) {
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: 'Missing botToken or chatId' };
    }
    // Build daily summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [newContactsRes, todayMessagesRes, pendingAppointmentsRes] = await Promise.all([
        db.select({ value: count() }).from(contacts).where(and(eq(contacts.orgId, orgId), gte(contacts.createdAt, today))),
        db.select({ value: count() }).from(messages).where(and(gte(messages.createdAt, today), sql `EXISTS (SELECT 1 FROM ${conversations} WHERE ${conversations.id} = ${messages.conversationId} AND ${conversations.orgId} = ${orgId})`)),
        db.select({ value: count() }).from(appointments).where(and(eq(appointments.orgId, orgId), eq(appointments.status, 'scheduled'), gte(appointments.appointmentDate, today))),
    ]);
    const newContacts = newContactsRes[0].value;
    const todayMessages = todayMessagesRes[0].value;
    const pendingAppointments = pendingAppointmentsRes[0].value;
    const text = [
        '📊 *ZaloCRM — Tóm tắt hôm nay*',
        '',
        `👤 Khách hàng mới: ${newContacts}`,
        `💬 Tin nhắn: ${todayMessages}`,
        `📅 Lịch hẹn chờ: ${pendingAppointments}`,
        '',
        `🕐 ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ].join('\n');
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            const body = await response.text();
            logger.error('[telegram-bot] API error:', body);
            return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: `Telegram API ${response.status}: ${body.slice(0, 200)}` };
        }
        logger.info(`[telegram-bot] Sent daily summary to chat ${chatId}`);
        return { direction: 'export', recordCount: 1, status: 'success' };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { direction: 'export', recordCount: 0, status: 'failed', errorMessage: msg };
    }
}
//# sourceMappingURL=telegram-bot.js.map