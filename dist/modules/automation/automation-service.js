import { db } from '../../shared/database/db.js';
import { automationRules, conversations } from '../../shared/database/schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { assignUserAction } from './actions/assign-user-action.js';
import { updateStatusAction } from './actions/update-status-action.js';
import { createAppointmentAction } from './actions/create-appointment-action.js';
import { sendTemplateAction } from './actions/send-template-action.js';
const MAX_AUTOMATION_DEPTH = 3;
export async function runAutomationRules(context) {
    if (context.initiatedByAutomation)
        return;
    const depth = context._depth ?? 0;
    if (depth >= MAX_AUTOMATION_DEPTH) {
        logger.warn('[automation] Max recursion depth reached, skipping');
        return;
    }
    const rules = await db.query.automationRules.findMany({
        where: and(eq(automationRules.orgId, context.orgId), eq(automationRules.trigger, context.trigger), eq(automationRules.enabled, true)),
        orderBy: [desc(automationRules.priority), asc(automationRules.createdAt)],
    });
    for (const rule of rules) {
        try {
            const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
            const actions = Array.isArray(rule.actions) ? rule.actions : [];
            if (!matchesConditions(conditions, context))
                continue;
            for (const action of actions) {
                await executeAction(action, context);
            }
            await db.update(automationRules)
                .set({
                runCount: sql `${automationRules.runCount} + 1`,
                lastRunAt: new Date(),
                updatedAt: new Date()
            })
                .where(eq(automationRules.id, rule.id));
        }
        catch (error) {
            logger.error(`[automation] Rule "${rule.name}" (${rule.id}) execution failed:`, error);
        }
    }
}
function matchesConditions(conditions, context) {
    return conditions.every((condition) => evaluateCondition(condition, context));
}
function evaluateCondition(condition, context) {
    const current = getFieldValue(condition.field, context);
    switch (condition.op) {
        case 'eq': return current === condition.value;
        case 'neq': return current !== condition.value;
        case 'contains': return String(current ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
        case 'in': return Array.isArray(condition.value) ? condition.value.includes(current) : false;
        case 'gt': return Number(current ?? 0) > Number(condition.value ?? 0);
        case 'lt': return Number(current ?? 0) < Number(condition.value ?? 0);
        case 'is_empty': return current === null || current === undefined || current === '';
        case 'is_not_empty': return !(current === null || current === undefined || current === '');
        default: return false;
    }
}
function getFieldValue(field, context) {
    switch (field) {
        case 'contact.source': return context.contact?.source;
        case 'contact.status': return context.contact?.status;
        case 'contact.assignedUserId': return context.contact?.assignedUserId;
        case 'message.content': return context.message?.content;
        case 'message.contentType': return context.message?.contentType;
        case 'conversation.unreadCount': return context.conversation?.unreadCount;
        default: return undefined;
    }
}
async function executeAction(action, context) {
    if (!context.contact?.id)
        return;
    if (action.type === 'assign_user' && action.userId) {
        await assignUserAction(context.contact.id, action.userId, context.orgId);
        return;
    }
    if (action.type === 'update_status' && action.status) {
        await updateStatusAction(context.contact.id, action.status);
        return;
    }
    if (action.type === 'create_appointment') {
        await createAppointmentAction({
            orgId: context.orgId,
            contactId: context.contact.id,
            assignedUserId: context.contact.assignedUserId ?? null,
            offsetHours: action.offsetHours,
            typeLabel: action.typeLabel,
            notes: action.notes,
        });
        return;
    }
    if (action.type === 'send_template' && context.conversation?.id && context.conversation.zaloAccountId) {
        const sentMessage = await sendTemplateAction({
            templateId: action.templateId,
            orgId: context.orgId,
            conversationId: context.conversation.id,
            zaloAccountId: context.conversation.zaloAccountId,
            threadId: context.conversation.threadId ?? null,
            threadType: context.conversation.threadType ?? 'user',
            context: { org: context.org, contact: context.contact, conversation: context.conversation },
        });
        if (sentMessage) {
            await db.update(conversations)
                .set({
                lastMessageAt: new Date(),
                isReplied: true,
                unreadCount: 0
            })
                .where(eq(conversations.id, context.conversation.id));
        }
    }
}
//# sourceMappingURL=automation-service.js.map