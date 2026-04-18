/**
 * custom-report.ts — Execute user-defined report from predefined metrics.
 * Supports 6 metrics, 5 groupBy options, optional filters.
 */
import { db } from '../../../shared/database/db.js';
import { sql } from 'drizzle-orm';
export async function executeCustomReport(orgId, config) {
    const { from, to } = config.dateRange;
    const startDate = new Date(from);
    const endDate = new Date(to);
    endDate.setDate(endDate.getDate() + 1);
    const datasets = [];
    let labels = [];
    for (const metric of config.metrics) {
        const result = await queryMetric(orgId, metric, config.groupBy, startDate, endDate, config.filters);
        if (!labels.length)
            labels = result.labels;
        datasets.push({ metric, data: result.data });
    }
    return { labels, datasets };
}
async function queryMetric(orgId, metric, groupBy, gte, lt, filters) {
    switch (metric) {
        case 'messages_sent':
        case 'messages_received':
            return queryMessageMetric(orgId, metric, groupBy, gte, lt, filters);
        case 'contacts_new':
            return queryContactMetric(orgId, 'new', groupBy, gte, lt, filters);
        case 'contacts_converted':
            return queryContactMetric(orgId, 'converted', groupBy, gte, lt, filters);
        case 'appointments':
            return queryAppointmentMetric(orgId, groupBy, gte, lt);
        case 'avg_response_time':
            return queryResponseTimeMetric(orgId, groupBy, gte, lt, filters);
        default:
            return { labels: [], data: [] };
    }
}
async function queryMessageMetric(orgId, metric, groupBy, gte, lt, filters) {
    const senderType = metric === 'messages_sent' ? 'self' : 'contact';
    const dateExpr = groupByDateExpr(groupBy, 'm.sent_at');
    if (groupBy === 'user') {
        const rows = db.all(sql `
      SELECT u.full_name AS label, COUNT(*) AS cnt
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN users u ON u.id = m.replied_by_user_id
      WHERE c.org_id = ${orgId} AND m.sender_type = ${senderType}
        AND m.sent_at >= ${gte.getTime()} AND m.sent_at < ${lt.getTime()}
      GROUP BY u.full_name ORDER BY cnt DESC
    `);
        return {
            labels: rows.map((r) => r.label ?? 'N/A'),
            data: rows.map((r) => Number(r.cnt))
        };
    }
    if (groupBy === 'source') {
        const rows = db.all(sql `
      SELECT COALESCE(ct.source, 'N/A') AS label, COUNT(*) AS cnt
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.org_id = ${orgId} AND m.sender_type = ${senderType}
        AND m.sent_at >= ${gte.getTime()} AND m.sent_at < ${lt.getTime()}
      GROUP BY ct.source ORDER BY cnt DESC
    `);
        return {
            labels: rows.map((r) => String(r.label)),
            data: rows.map((r) => Number(r.cnt))
        };
    }
    const rows = db.all(sql `
    SELECT ${sql.raw(dateExpr)} AS label, COUNT(*) AS cnt
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.org_id = ${orgId} AND m.sender_type = ${senderType}
      AND m.sent_at >= ${gte.getTime()} AND m.sent_at < ${lt.getTime()}
    GROUP BY label ORDER BY label ASC
  `);
    return {
        labels: rows.map((r) => String(r.label)),
        data: rows.map((r) => Number(r.cnt))
    };
}
async function queryContactMetric(orgId, type, groupBy, gte, lt, filters) {
    const dateCol = type === 'new' ? 'created_at' : 'updated_at';
    const statusCond = type === 'converted' ? sql `AND status = 'converted'` : sql ``;
    const sourceCond = filters?.source ? sql `AND source = ${filters.source}` : sql ``;
    if (groupBy === 'user') {
        const rows = db.all(sql `
      SELECT COALESCE(u.full_name, 'Chưa gán') AS label, COUNT(*) AS cnt
      FROM contacts c LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE c.org_id = ${orgId} AND c.${sql.raw(dateCol)} >= ${gte.getTime()} AND c.${sql.raw(dateCol)} < ${lt.getTime()}
        ${statusCond} ${sourceCond}
      GROUP BY u.full_name ORDER BY cnt DESC
    `);
        return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Number(r.cnt)) };
    }
    if (groupBy === 'source') {
        const rows = db.all(sql `
      SELECT COALESCE(source, 'N/A') AS label, COUNT(*) AS cnt
      FROM contacts WHERE org_id = ${orgId} AND ${sql.raw(dateCol)} >= ${gte.getTime()} AND ${sql.raw(dateCol)} < ${lt.getTime()}
        ${statusCond}
      GROUP BY source ORDER BY cnt DESC
    `);
        return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Number(r.cnt)) };
    }
    const dateExpr = groupByDateExpr(groupBy, dateCol);
    const rows = db.all(sql `
    SELECT ${sql.raw(dateExpr)} AS label, COUNT(*) AS cnt
    FROM contacts WHERE org_id = ${orgId} AND ${sql.raw(dateCol)} >= ${gte.getTime()} AND ${sql.raw(dateCol)} < ${lt.getTime()}
      ${statusCond} ${sourceCond}
    GROUP BY label ORDER BY label ASC
  `);
    return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Number(r.cnt)) };
}
async function queryAppointmentMetric(orgId, groupBy, gte, lt) {
    if (groupBy === 'user') {
        const rows = db.all(sql `
      SELECT COALESCE(u.full_name, 'Chưa gán') AS label, COUNT(*) AS cnt
      FROM appointments a LEFT JOIN users u ON u.id = a.assigned_user_id
      WHERE a.org_id = ${orgId} AND a.appointment_date >= ${gte.getTime()} AND a.appointment_date < ${lt.getTime()}
      GROUP BY u.full_name ORDER BY cnt DESC
    `);
        return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Number(r.cnt)) };
    }
    const dateExpr = groupByDateExpr(groupBy, 'appointment_date');
    const rows = db.all(sql `
    SELECT ${sql.raw(dateExpr)} AS label, COUNT(*) AS cnt
    FROM appointments WHERE org_id = ${orgId} AND appointment_date >= ${gte.getTime()} AND appointment_date < ${lt.getTime()}
    GROUP BY label ORDER BY label ASC
  `);
    return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Number(r.cnt)) };
}
async function queryResponseTimeMetric(orgId, groupBy, gte, lt, filters) {
    if (groupBy === 'user') {
        const rows = db.all(sql `
      SELECT u.full_name AS label, AVG(d.avg_response_time_seconds) AS avg_rt
      FROM daily_message_stats d JOIN users u ON u.id = d.user_id
      WHERE d.org_id = ${orgId} AND d.stat_date >= ${gte.toISOString().split('T')[0]} AND d.stat_date < ${lt.toISOString().split('T')[0]}
        AND d.avg_response_time_seconds IS NOT NULL
      GROUP BY u.full_name ORDER BY avg_rt ASC
    `);
        return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Math.round(Number(r.avg_rt))) };
    }
    const dateExpr = groupByDateExpr(groupBy, 'stat_date');
    const rows = db.all(sql `
    SELECT ${sql.raw(dateExpr)} AS label, AVG(avg_response_time_seconds) AS avg_rt
    FROM daily_message_stats
    WHERE org_id = ${orgId} AND stat_date >= ${gte.toISOString().split('T')[0]} AND stat_date < ${lt.toISOString().split('T')[0]}
      AND avg_response_time_seconds IS NOT NULL
    GROUP BY label ORDER BY label ASC
  `);
    return { labels: rows.map((r) => String(r.label)), data: rows.map((r) => Math.round(Number(r.avg_rt))) };
}
function groupByDateExpr(groupBy, col) {
    // SQLite strftime: %Y-%m-%d, %Y-%m (month), week is harder
    // For week, we use strftime('%Y-W%W', date / 1000, 'unixepoch')
    const dateCol = `datetime(${col} / 1000, 'unixepoch')`;
    switch (groupBy) {
        case 'week':
            return `strftime('%Y-W%W', ${dateCol})`;
        case 'month':
            return `strftime('%Y-%m', ${dateCol})`;
        default: // day
            return `strftime('%Y-%m-%d', ${dateCol})`;
    }
}
//# sourceMappingURL=custom-report.js.map