import { db } from '../../shared/database/db.js';
import { conversations, messages, contacts, zaloAccountAccess } from '../../shared/database/schema.js';
import { eq, and, or, like, desc, count, inArray } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireZaloAccess } from '../zalo/zalo-access-middleware.js';
import { zaloPool } from '../zalo/zalo-pool.js';
import { zaloRateLimiter } from '../zalo/zalo-rate-limiter.js';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
export async function chatRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // ── List conversations (paginated) ──────────────────────────────────────
    app.get('/api/v1/conversations', async (request, reply) => {
        const user = request.user;
        const { page = '1', limit = '50', search = '', accountId = '' } = request.query;
        let filters = eq(conversations.orgId, user.orgId);
        if (accountId) {
            filters = and(filters, eq(conversations.zaloAccountId, accountId));
        }
        if (search) {
            // Find contacts first since SQLite doesn't support easy joining with filtering on the join in findMany with 'with'
            const matchedContacts = await db.query.contacts.findMany({
                where: and(eq(contacts.orgId, user.orgId), or(like(contacts.fullName, `%${search}%`), like(contacts.phone, `%${search}%`))),
                columns: { id: true }
            });
            const contactIds = matchedContacts.map(c => c.id);
            if (contactIds.length > 0) {
                filters = and(filters, inArray(conversations.contactId, contactIds));
            }
            else {
                // No match found
                return { conversations: [], total: 0, page: parseInt(page), limit: parseInt(limit) };
            }
        }
        // Members can only see conversations from Zalo accounts they have access to
        if (user.role === 'member') {
            const accessibleAccounts = await db.query.zaloAccountAccess.findMany({
                where: eq(zaloAccountAccess.userId, user.id),
                columns: { zaloAccountId: true },
            });
            const accIds = accessibleAccounts.map((a) => a.zaloAccountId);
            if (accIds.length > 0) {
                filters = and(filters, inArray(conversations.zaloAccountId, accIds));
            }
            else {
                return { conversations: [], total: 0, page: parseInt(page), limit: parseInt(limit) };
            }
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const [convs, totalResult] = await Promise.all([
            db.query.conversations.findMany({
                where: filters,
                with: {
                    contact: {
                        columns: { id: true, fullName: true, phone: true, avatarUrl: true, zaloUid: true }
                    },
                    zaloAccount: {
                        columns: { id: true, displayName: true, zaloUid: true }
                    },
                    messages: {
                        limit: 1,
                        orderBy: [desc(messages.sentAt)],
                        columns: { content: true, contentType: true, senderType: true, sentAt: true, isDeleted: true },
                    },
                },
                orderBy: [desc(conversations.lastMessageAt)],
                offset: (pageNum - 1) * limitNum,
                limit: limitNum,
            }),
            db.select({ value: count() }).from(conversations).where(filters),
        ]);
        return {
            conversations: convs,
            total: totalResult[0].value,
            page: pageNum,
            limit: limitNum
        };
    });
    // ── Get single conversation ──────────────────────────────────────────────
    app.get('/api/v1/conversations/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const conversation = await db.query.conversations.findFirst({
            where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
            with: {
                contact: true,
                zaloAccount: {
                    columns: { id: true, displayName: true, zaloUid: true, status: true }
                },
            },
        });
        if (!conversation)
            return reply.status(404).send({ error: 'Not found' });
        return conversation;
    });
    // ── List messages for a conversation (paginated, newest first) ──────────
    app.get('/api/v1/conversations/:id/messages', { preHandler: requireZaloAccess('read') }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const { page = '1', limit = '50' } = request.query;
        const conversation = await db.query.conversations.findFirst({
            where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
            columns: { id: true },
        });
        if (!conversation)
            return reply.status(404).send({ error: 'Conversation not found' });
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const [msgs, totalResult] = await Promise.all([
            db.query.messages.findMany({
                where: eq(messages.conversationId, id),
                orderBy: [desc(messages.sentAt)],
                offset: (pageNum - 1) * limitNum,
                limit: limitNum,
            }),
            db.select({ value: count() }).from(messages).where(eq(messages.conversationId, id)),
        ]);
        return {
            messages: msgs.reverse(),
            total: totalResult[0].value,
            page: pageNum,
            limit: limitNum
        };
    });
    // ── Send message ─────────────────────────────────────────────────────────
    app.post('/api/v1/conversations/:id/messages', { preHandler: requireZaloAccess('chat') }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const { content } = request.body;
        if (!content?.trim())
            return reply.status(400).send({ error: 'Content required' });
        const conversation = await db.query.conversations.findFirst({
            where: and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)),
            with: { zaloAccount: true },
        });
        if (!conversation)
            return reply.status(404).send({ error: 'Conversation not found' });
        const instance = zaloPool.getInstance(conversation.zaloAccountId);
        if (!instance?.api)
            return reply.status(400).send({ error: 'Zalo account not connected' });
        // Rate limit check — prevent account blocking
        const limits = zaloRateLimiter.checkLimits(conversation.zaloAccountId);
        if (!limits.allowed) {
            return reply.status(429).send({ error: limits.reason });
        }
        try {
            const threadId = conversation.externalThreadId || '';
            // zca-js sendMessage(message, threadId, type) — type: 0=User, 1=Group
            const threadType = conversation.threadType === 'group' ? 1 : 0;
            zaloRateLimiter.recordSend(conversation.zaloAccountId);
            await instance.api.sendMessage({ msg: content }, threadId, threadType);
            const msgId = uuidv4();
            await db.insert(messages).values({
                id: msgId,
                conversationId: id,
                senderType: 'self',
                senderUid: conversation.zaloAccount.zaloUid || '',
                senderName: 'Staff',
                content,
                contentType: 'text',
                sentAt: new Date(),
                repliedByUserId: user.id,
            });
            const message = await db.query.messages.findFirst({
                where: eq(messages.id, msgId)
            });
            await db.update(conversations)
                .set({
                lastMessageAt: new Date(),
                isReplied: true,
                unreadCount: 0
            })
                .where(eq(conversations.id, id));
            const io = app.io;
            io?.emit('chat:message', { accountId: conversation.zaloAccountId, message, conversationId: id });
            return message;
        }
        catch (err) {
            logger.error('[chat] Send message error:', err);
            return reply.status(500).send({ error: 'Failed to send message' });
        }
    });
    // ── Mark conversation as read ────────────────────────────────────────────
    app.post('/api/v1/conversations/:id/mark-read', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        await db.update(conversations)
            .set({ unreadCount: 0 })
            .where(and(eq(conversations.id, id), eq(conversations.orgId, user.orgId)));
        return { success: true };
    });
}
//# sourceMappingURL=chat-routes.js.map