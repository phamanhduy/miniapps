export type AutomationTriggerType = 'message_received' | 'contact_created' | 'status_changed';
export interface AutomationContext {
    trigger: AutomationTriggerType;
    orgId: string;
    initiatedByAutomation?: boolean;
    _depth?: number;
    contact?: {
        id: string;
        fullName: string | null;
        phone: string | null;
        status: string | null;
        source?: string | null;
        assignedUserId?: string | null;
    } | null;
    conversation?: {
        id: string;
        unreadCount?: number;
        threadId?: string | null;
        threadType?: string;
        zaloAccountId?: string;
    } | null;
    message?: {
        id: string;
        content: string | null;
        contentType: string;
        senderType?: string;
    } | null;
    org?: {
        id: string;
        name: string | null;
    } | null;
}
export declare function runAutomationRules(context: AutomationContext): Promise<void>;
//# sourceMappingURL=automation-service.d.ts.map