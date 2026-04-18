import { db } from '../../shared/database/db.js';
import { conversations, zaloAccountAccess } from '../../shared/database/schema.js';
import { eq, and } from 'drizzle-orm';
const hierarchy = { read: 1, chat: 2, admin: 3 };
// Factory: returns a preHandler that checks the user has at least minPermission on the Zalo account
export function requireZaloAccess(minPermission) {
    return async (request, reply) => {
        const user = request.user;
        // Owner/admin bypass — full access to all accounts in their org
        if (['owner', 'admin'].includes(user.role))
            return;
        const params = request.params;
        let zaloAccountId = params.zaloAccountId || params.id;
        // If accessing via conversation, look up the Zalo account from the conversation
        if (params.id && !params.zaloAccountId) {
            try {
                const conv = await db.query.conversations.findFirst({
                    where: and(eq(conversations.id, params.id), eq(conversations.orgId, user.orgId)),
                    columns: { zaloAccountId: true },
                });
                if (conv)
                    zaloAccountId = conv.zaloAccountId;
            }
            catch {
                return reply.status(500).send({ error: 'Internal error checking access' });
            }
        }
        if (!zaloAccountId)
            return reply.status(404).send({ error: 'Not found' });
        try {
            const access = await db.query.zaloAccountAccess.findFirst({
                where: and(eq(zaloAccountAccess.zaloAccountId, zaloAccountId), eq(zaloAccountAccess.userId, user.id)),
            });
            if (!access) {
                return reply.status(403).send({ error: 'Không có quyền truy cập tài khoản Zalo này' });
            }
            const userLevel = hierarchy[access.permission] ?? 0;
            if (userLevel < hierarchy[minPermission]) {
                return reply.status(403).send({ error: 'Không đủ quyền' });
            }
        }
        catch {
            return reply.status(500).send({ error: 'Internal error checking access' });
        }
    };
}
//# sourceMappingURL=zalo-access-middleware.js.map