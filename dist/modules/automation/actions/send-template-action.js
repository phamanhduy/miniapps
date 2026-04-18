import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../shared/database/db.js';
import { messageTemplates, messages } from '../../../shared/database/schema.js';
import { eq, and } from 'drizzle-orm';
import { renderMessageTemplate } from '../template-renderer.js';
import { zaloPool } from '../../zalo/zalo-pool.js';
import { zaloRateLimiter } from '../../zalo/zalo-rate-limiter.js';
export async function sendTemplateAction(input) {
    if (!input.threadId)
        return null;
    const template = await db.query.messageTemplates.findFirst({
        where: and(eq(messageTemplates.id, input.templateId), eq(messageTemplates.orgId, input.orgId)),
        columns: { id: true, content: true },
    });
    if (!template)
        return null;
    const content = renderMessageTemplate(template.content, input.context).trim();
    if (!content)
        return null;
    const instance = zaloPool.getInstance(input.zaloAccountId);
    if (!instance?.api)
        return null;
    const limits = zaloRateLimiter.checkLimits(input.zaloAccountId);
    if (!limits.allowed)
        return null;
    zaloRateLimiter.recordSend(input.zaloAccountId);
    const threadTypeNum = input.threadType === 'group' ? 1 : 0;
    await instance.api.sendMessage({ msg: content }, input.threadId, threadTypeNum);
    const messageId = uuidv4();
    await db.insert(messages).values({
        id: messageId,
        conversationId: input.conversationId,
        senderType: 'self',
        senderUid: null,
        senderName: 'Automation',
        content,
        contentType: 'text',
        sentAt: new Date(),
    });
    return await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
}
//# sourceMappingURL=send-template-action.js.map