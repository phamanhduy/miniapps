import { db } from '../../shared/database/db.js';
import { messages, conversations, contacts, appointments } from '../../shared/database/schema.js';
import { eq, and, gte, lte, count, sql, asc } from 'drizzle-orm';
export async function buildMessagesSheet(workbook, orgId, from, to) {
    const sheet = workbook.addWorksheet('Tin nhắn');
    sheet.columns = [
        { header: 'Ngày', key: 'date', width: 15 },
        { header: 'Đã gửi', key: 'sent', width: 12 },
        { header: 'Đã nhận', key: 'received', width: 12 },
        { header: 'Tổng', key: 'total', width: 12 },
    ];
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const rows = await db.select({
        date: sql `strftime('%Y-%m-%d', datetime(${messages.sentAt} / 1000, 'unixepoch'))`.as('date'),
        sent: sql `SUM(CASE WHEN ${messages.senderType} = 'self' THEN 1 ELSE 0 END)`.as('sent'),
        received: sql `SUM(CASE WHEN ${messages.senderType} = 'contact' THEN 1 ELSE 0 END)`.as('received'),
        total: count()
    })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(and(eq(conversations.orgId, orgId), gte(messages.sentAt, fromDate), lte(messages.sentAt, toDate)))
        .groupBy(sql `date`)
        .orderBy(asc(sql `date`));
    for (const r of rows) {
        sheet.addRow({
            date: r.date,
            sent: Number(r.sent),
            received: Number(r.received),
            total: Number(r.total),
        });
    }
}
export async function buildContactsSheet(workbook, orgId, from, to) {
    const sheet = workbook.addWorksheet('Liên hệ');
    sheet.columns = [
        { header: 'Ngày', key: 'date', width: 15 },
        { header: 'Liên hệ mới', key: 'count', width: 15 },
    ];
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const rows = await db.select({
        date: sql `strftime('%Y-%m-%d', datetime(${contacts.createdAt} / 1000, 'unixepoch'))`.as('date'),
        count: count()
    })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), gte(contacts.createdAt, fromDate), lte(contacts.createdAt, toDate)))
        .groupBy(sql `date`)
        .orderBy(asc(sql `date`));
    for (const r of rows) {
        sheet.addRow({
            date: r.date,
            count: Number(r.count),
        });
    }
}
export async function buildAppointmentsSheet(workbook, orgId, from, to) {
    const sheet = workbook.addWorksheet('Lịch hẹn');
    sheet.columns = [
        { header: 'Trạng thái', key: 'status', width: 20 },
        { header: 'Số lượng', key: 'count', width: 12 },
    ];
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    const stats = await db.select({
        status: appointments.status,
        count: count()
    })
        .from(appointments)
        .where(and(eq(appointments.orgId, orgId), gte(appointments.appointmentDate, fromDate), lte(appointments.appointmentDate, toDate)))
        .groupBy(appointments.status);
    for (const s of stats) {
        sheet.addRow({ status: s.status, count: s.count });
    }
}
//# sourceMappingURL=excel-sheet-builders.js.map