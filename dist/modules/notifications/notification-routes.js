import { db } from '../../shared/database/db.js';
import { conversations, appointments, zaloAccounts } from '../../shared/database/schema.js';
import { eq, and, lt, gte, count } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { zaloPool } from '../zalo/zalo-pool.js';
export async function notificationRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    app.get('/api/v1/notifications', async (request) => {
        const user = request.user;
        const notifications = [];
        // 1. Unreplied conversations > 30 min
        const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
        const unrepliedRes = await db.select({ value: count() })
            .from(conversations)
            .where(and(eq(conversations.orgId, user.orgId), eq(conversations.isReplied, false), lt(conversations.lastMessageAt, thirtyMinAgo)));
        const unreplied = unrepliedRes[0].value;
        if (unreplied > 0) {
            notifications.push({
                id: 'unreplied',
                type: 'warning',
                priority: 'high',
                title: `${unreplied} cuộc trò chuyện chưa trả lời`,
                detail: 'Có tin nhắn chưa phản hồi quá 30 phút',
                createdAt: new Date().toISOString(),
            });
        }
        // 2. Today's appointments
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const todayApts = await db.query.appointments.findMany({
            where: and(eq(appointments.orgId, user.orgId), gte(appointments.appointmentDate, todayStart), lt(appointments.appointmentDate, todayEnd), eq(appointments.status, 'scheduled')),
            with: { contact: { columns: { fullName: true } } },
            limit: 5,
        });
        for (const apt of todayApts) {
            notifications.push({
                id: `apt-${apt.id}`,
                type: 'info',
                priority: 'medium',
                title: `Lịch hẹn: ${apt.contact?.fullName || 'KH'}`,
                detail: `${apt.appointmentTime || ''} - ${apt.notes || 'Tái khám'}`,
                createdAt: apt.appointmentDate.toISOString(),
            });
        }
        // 3. Tomorrow's appointments
        const tomorrowStart = new Date(todayEnd);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        const tmrAptsRes = await db.select({ value: count() })
            .from(appointments)
            .where(and(eq(appointments.orgId, user.orgId), gte(appointments.appointmentDate, tomorrowStart), lt(appointments.appointmentDate, tomorrowEnd), eq(appointments.status, 'scheduled')));
        const tmrApts = tmrAptsRes[0].value;
        if (tmrApts > 0) {
            notifications.push({
                id: 'tmr-apts',
                type: 'info',
                priority: 'low',
                title: `${tmrApts} lịch hẹn ngày mai`,
                detail: 'Chuẩn bị cho ngày mai',
                createdAt: new Date().toISOString(),
            });
        }
        // 4. Disconnected Zalo accounts
        const accounts = await db.query.zaloAccounts.findMany({
            where: eq(zaloAccounts.orgId, user.orgId),
            columns: { id: true, displayName: true },
        });
        for (const acc of accounts) {
            const status = zaloPool.getStatus(acc.id);
            if (status !== 'connected') {
                notifications.push({
                    id: `zalo-${acc.id}`,
                    type: 'error',
                    priority: 'high',
                    title: `Zalo "${acc.displayName}" mất kết nối`,
                    detail: `Trạng thái: ${status}`,
                    createdAt: new Date().toISOString(),
                });
            }
        }
        return { notifications };
    });
}
//# sourceMappingURL=notification-routes.js.map