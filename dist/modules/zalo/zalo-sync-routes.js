import { db } from '../../shared/database/db.js';
import { contacts } from '../../shared/database/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireRole } from '../auth/role-middleware.js';
import { zaloPool } from './zalo-pool.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
export async function zaloSyncRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // Sync all friends from a Zalo account to contacts
    app.post('/api/v1/zalo-accounts/:id/sync-contacts', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const instance = zaloPool.getInstance(id);
        if (!instance?.api)
            return reply.status(400).send({ error: 'Zalo account not connected' });
        try {
            const result = await instance.api.getAllFriends();
            // getAllFriends returns object with profiles
            const friends = Object.values(result || {});
            let created = 0, updated = 0;
            for (const friend of friends) {
                const uid = friend.userId || friend.uid || '';
                if (!uid)
                    continue;
                const zaloName = friend.zaloName || friend.zalo_name || friend.displayName || friend.display_name || '';
                const avatar = friend.avatar || '';
                const phone = friend.phoneNumber || '';
                const existing = await db.query.contacts.findFirst({
                    where: and(eq(contacts.zaloUid, uid), eq(contacts.orgId, user.orgId)),
                });
                if (existing) {
                    await db.update(contacts)
                        .set({
                        fullName: zaloName || existing.fullName,
                        avatarUrl: avatar || existing.avatarUrl,
                        phone: phone || existing.phone,
                        updatedAt: new Date(),
                    })
                        .where(eq(contacts.id, existing.id));
                    updated++;
                }
                else {
                    await db.insert(contacts).values({
                        id: uuidv4(),
                        orgId: user.orgId,
                        zaloUid: uid,
                        fullName: zaloName || 'Unknown',
                        avatarUrl: avatar || null,
                        phone: phone || null,
                    });
                    created++;
                }
            }
            logger.info(`[sync] Zalo contacts: ${created} created, ${updated} updated`);
            return { success: true, created, updated, total: friends.length };
        }
        catch (err) {
            logger.error('[sync] Zalo contacts error:', err);
            return reply.status(500).send({ error: 'Sync failed: ' + String(err) });
        }
    });
}
//# sourceMappingURL=zalo-sync-routes.js.map