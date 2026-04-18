import { db } from '../../shared/database/db.js';
import { conversations, zaloAccountAccess } from '../../shared/database/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireRole } from '../auth/role-middleware.js';
import { requireZaloAccess } from '../zalo/zalo-access-middleware.js';
import { getAiConfig, getAiUsage, updateAiConfig, generateAiOutput } from './ai-service.js';
import { getAvailableProviders } from './provider-registry.js';
import { logger } from '../../shared/utils/logger.js';
async function assertConversationReadAccess(request, reply, conversationId) {
    const user = request.user;
    const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.id, conversationId), eq(conversations.orgId, user.orgId)),
        columns: { id: true, zaloAccountId: true },
    });
    if (!conversation) {
        reply.status(404).send({ error: 'Conversation not found' });
        return null;
    }
    if (['owner', 'admin'].includes(user.role))
        return conversation;
    const access = await db.query.zaloAccountAccess.findFirst({
        where: and(eq(zaloAccountAccess.zaloAccountId, conversation.zaloAccountId), eq(zaloAccountAccess.userId, user.id)),
        columns: { permission: true },
    });
    if (!access) {
        reply.status(403).send({ error: 'Không có quyền truy cập tài khoản Zalo này' });
        return null;
    }
    return conversation;
}
function getStatusFromError(err, fallback) {
    const message = err instanceof Error ? err.message : fallback;
    const status = message.includes('quota exceeded') ? 429 : message.includes('not found') ? 404 : message.includes('disabled') || message.includes('configured') ? 400 : 500;
    return { message, status };
}
function sendHandledError(reply, err, fallback) {
    const handled = getStatusFromError(err, fallback);
    const safeMessage = handled.status === 500 ? fallback : handled.message;
    return reply.status(handled.status).send({ error: safeMessage });
}
export async function aiRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    /* Returns available AI providers + their models (based on .env config) */
    app.get('/api/v1/ai/providers', async () => {
        return getAvailableProviders();
    });
    app.get('/api/v1/ai/config', async (request, reply) => {
        try {
            return await getAiConfig(request.user.orgId);
        }
        catch (err) {
            logger.error('[ai] Get config error:', err);
            return reply.status(500).send({ error: 'Failed to fetch AI config' });
        }
    });
    app.put('/api/v1/ai/config', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        try {
            const body = request.body;
            if (body.maxDaily !== undefined && body.maxDaily < 1)
                return reply.status(400).send({ error: 'maxDaily must be at least 1' });
            return await updateAiConfig(request.user.orgId, body);
        }
        catch (err) {
            logger.error('[ai] Update config error:', err);
            return reply.status(500).send({ error: 'Failed to update AI config' });
        }
    });
    app.get('/api/v1/ai/usage', async (request, reply) => {
        try {
            return await getAiUsage(request.user.orgId);
        }
        catch (err) {
            logger.error('[ai] Usage error:', err);
            return reply.status(500).send({ error: 'Failed to fetch AI usage' });
        }
    });
    app.post('/api/v1/ai/suggest', async (request, reply) => {
        try {
            const body = request.body;
            if (!body.conversationId)
                return reply.status(400).send({ error: 'conversationId is required' });
            const access = await assertConversationReadAccess(request, reply, body.conversationId);
            if (!access)
                return;
            return await generateAiOutput({ orgId: request.user.orgId, conversationId: body.conversationId, messageId: body.messageId, type: 'reply_draft' });
        }
        catch (err) {
            logger.error('[ai] Suggest error:', err);
            return sendHandledError(reply, err, 'Failed to generate AI suggestion');
        }
    });
    app.post('/api/v1/ai/summarize/:id', { preHandler: requireZaloAccess('read') }, async (request, reply) => {
        try {
            const { id } = request.params;
            return await generateAiOutput({ orgId: request.user.orgId, conversationId: id, type: 'summary' });
        }
        catch (err) {
            logger.error('[ai] Summary error:', err);
            return sendHandledError(reply, err, 'Failed to summarize conversation');
        }
    });
    app.post('/api/v1/ai/sentiment/:id', { preHandler: requireZaloAccess('read') }, async (request, reply) => {
        try {
            const { id } = request.params;
            return await generateAiOutput({ orgId: request.user.orgId, conversationId: id, type: 'sentiment' });
        }
        catch (err) {
            logger.error('[ai] Sentiment error:', err);
            return sendHandledError(reply, err, 'Failed to analyze sentiment');
        }
    });
}
//# sourceMappingURL=ai-routes.js.map