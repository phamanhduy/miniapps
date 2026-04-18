/**
 * message-handler.ts — persists incoming Zalo messages to the database.
 * Called from zalo-pool's startListener on every 'message' / 'undo' event.
 */
import { db } from '../../shared/database/db.js';
import { zaloAccounts, contacts, conversations, messages, organizations } from '../../shared/database/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { emitWebhook } from '../api/webhook-service.js';
import { runAutomationRules } from '../automation/automation-service.js';
export async function handleIncomingMessage(msg) {
    try {
        const account = await db.query.zaloAccounts.findFirst({
            where: eq(zaloAccounts.id, msg.accountId),
            columns: { orgId: true, ownerUserId: true },
        });
        if (!account)
            return null;
        const contactId = await upsertContact(msg, account.orgId);
        // Update lastActivity for lead scoring freshness
        if (contactId) {
            db.update(contacts)
                .set({ lastActivity: new Date() })
                .where(eq(contacts.id, contactId))
                .catch(() => { });
        }
        const conversation = await findOrCreateConversation(msg, account.orgId, contactId);
        const sentAt = new Date(msg.timestamp);
        const messageId = uuidv4();
        await db.insert(messages).values({
            id: messageId,
            conversationId: conversation.id,
            zaloMsgId: msg.msgId || null,
            senderType: msg.isSelf ? 'self' : 'contact',
            senderUid: msg.senderUid,
            senderName: msg.senderName || null,
            content: msg.content || '',
            contentType: msg.contentType || 'text',
            attachments: msg.attachments ?? [],
            sentAt,
        });
        const message = await db.query.messages.findFirst({
            where: eq(messages.id, messageId)
        });
        await updateConversationAfterMessage(conversation.id, sentAt, msg.isSelf);
        // Track first outbound contact date — set once when agent sends first message
        if (msg.isSelf && contactId) {
            db.update(contacts)
                .set({ firstContactDate: new Date(msg.timestamp) })
                .where(and(eq(contacts.id, contactId), sql `${contacts.firstContactDate} IS NULL`))
                .catch(() => { });
        }
        // Emit webhook for message event (fire-and-forget)
        if (message) {
            emitWebhook(account.orgId, msg.isSelf ? 'message.sent' : 'message.received', {
                messageId: message.id,
                conversationId: conversation.id,
                senderUid: msg.senderUid,
                content: msg.content,
                contentType: msg.contentType,
                sentAt: message.sentAt,
            });
        }
        if (!msg.isSelf && message) {
            const org = await db.query.organizations.findFirst({
                where: eq(organizations.id, account.orgId),
                columns: { id: true, name: true },
            });
            const contact = contactId
                ? await db.query.contacts.findFirst({
                    where: eq(contacts.id, contactId),
                    columns: { id: true, fullName: true, phone: true, status: true, source: true, assignedUserId: true },
                })
                : null;
            const conversationDetails = await db.query.conversations.findFirst({
                where: eq(conversations.id, conversation.id),
                columns: { id: true, unreadCount: true, externalThreadId: true, threadType: true, zaloAccountId: true },
            });
            void runAutomationRules({
                trigger: 'message_received',
                orgId: account.orgId,
                org: org,
                contact: contact,
                conversation: conversationDetails
                    ? {
                        id: conversationDetails.id,
                        unreadCount: conversationDetails.unreadCount,
                        threadId: conversationDetails.externalThreadId || '',
                        threadType: conversationDetails.threadType,
                        zaloAccountId: conversationDetails.zaloAccountId,
                    }
                    : null,
                message: { id: message.id, content: message.content || '', contentType: message.contentType, senderType: message.senderType },
            });
        }
        return {
            message,
            conversationId: conversation.id,
            orgId: account.orgId,
            contactId,
        };
    }
    catch (err) {
        logger.error('[message-handler] handleIncomingMessage error:', err);
        return null;
    }
}
// Upsert contact — handles both user and group conversations
async function upsertContact(msg, orgId) {
    // Group messages: create/update a "contact" record representing the group
    if (msg.threadType === 'group') {
        const groupUid = msg.threadId;
        let groupContact = await db.query.contacts.findFirst({
            where: and(eq(contacts.zaloUid, groupUid), eq(contacts.orgId, orgId)),
            columns: { id: true, fullName: true },
        });
        if (!groupContact) {
            const id = uuidv4();
            await db.insert(contacts).values({
                id,
                orgId,
                zaloUid: groupUid,
                fullName: msg.groupName || 'Nhóm',
                metadata: { isGroup: true },
            });
            groupContact = { id, fullName: msg.groupName || 'Nhóm' };
            // Emit webhook for new contact created
            emitWebhook(orgId, 'contact.created', { contactId: groupContact.id, fullName: groupContact.fullName });
        }
        else if (msg.groupName && groupContact.fullName !== msg.groupName) {
            await db.update(contacts)
                .set({ fullName: msg.groupName })
                .where(eq(contacts.id, groupContact.id));
        }
        return groupContact.id;
    }
    // User messages: self messages don't create a contact
    if (msg.isSelf)
        return null;
    let contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.zaloUid, msg.senderUid), eq(contacts.orgId, orgId)),
        columns: { id: true, fullName: true },
    });
    if (!contact) {
        const id = uuidv4();
        await db.insert(contacts).values({
            id,
            orgId,
            zaloUid: msg.senderUid,
            fullName: msg.senderName || 'Unknown',
        });
        contact = { id, fullName: msg.senderName || 'Unknown' };
        // Emit webhook for new contact created
        emitWebhook(orgId, 'contact.created', { contactId: contact.id, fullName: contact.fullName });
    }
    else if (msg.senderName && contact.fullName !== msg.senderName) {
        await db.update(contacts)
            .set({ fullName: msg.senderName })
            .where(eq(contacts.id, contact.id));
    }
    return contact.id;
}
// Find or create conversation — externalThreadId = threadId for both user and group
async function findOrCreateConversation(msg, orgId, contactId) {
    const externalThreadId = msg.threadId;
    const existing = await db.query.conversations.findFirst({
        where: and(eq(conversations.zaloAccountId, msg.accountId), eq(conversations.externalThreadId, externalThreadId)),
        columns: { id: true },
    });
    if (existing)
        return existing;
    const id = uuidv4();
    await db.insert(conversations).values({
        id,
        orgId,
        zaloAccountId: msg.accountId,
        contactId: contactId,
        threadType: msg.threadType,
        externalThreadId,
        lastMessageAt: new Date(msg.timestamp),
        unreadCount: msg.isSelf ? 0 : 1,
        isReplied: msg.isSelf,
    });
    return { id };
}
// Update conversation metadata after a new message
async function updateConversationAfterMessage(conversationId, sentAt, isSelf) {
    const updateData = { lastMessageAt: sentAt };
    if (isSelf) {
        updateData.isReplied = true;
        updateData.unreadCount = 0;
    }
    else {
        updateData.unreadCount = sql `${conversations.unreadCount} + 1`;
        updateData.isReplied = false;
    }
    await db.update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversationId));
}
// Soft-delete a message by its Zalo message ID
export async function handleMessageUndo(accountId, zaloMsgId) {
    try {
        await db.update(messages)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(eq(messages.zaloMsgId, String(zaloMsgId)));
        logger.info(`[message-handler] Undo message ${zaloMsgId} for account ${accountId}`);
    }
    catch (err) {
        logger.error('[message-handler] handleMessageUndo error:', err);
    }
}
//# sourceMappingURL=message-handler.js.map