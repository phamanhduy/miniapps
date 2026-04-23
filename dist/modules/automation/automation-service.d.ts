export type AutomationTrigger = 'new_contact' | 'contact_status_changed' | 'new_message_received' | 'message_sent' | 'appointment_scheduled' | 'friend_request_received';
export interface AutomationAction {
    type: string;
    params: any;
}
export interface AutomationContext {
    orgId: string;
    contact?: {
        id: string;
        fullName: string | null;
        phone: string | null;
        status: string | null;
        source?: string | null;
        assignedUserId?: string | null;
        tags?: any;
    } | null;
    conversation?: {
        id: string;
        unreadCount?: number;
        threadId?: string | null;
        threadType?: string;
        zaloAccountId?: string | null;
    } | null;
    message?: {
        id: string;
        content: string | null;
        contentType: string;
        senderType?: string;
    } | null;
    initiatedByAutomation?: boolean;
    _depth?: number;
    org?: {
        id: string;
        name: string | null;
    } | null;
}
declare class AutomationService {
    /**
     * Main entry point: evaluates rules for a given trigger and executes matching actions.
     * Prevents infinite loops by tracking recursion depth.
     */
    trigger(orgId: string, trigger: AutomationTrigger, context: AutomationContext): Promise<void>;
    private evaluateConditions;
    private executeActions;
    private runAction;
    private getValueByPath;
}
export declare const automationService: AutomationService;
export declare const runAutomationRules: (orgId: string, trigger: AutomationTrigger, context: AutomationContext) => Promise<void>;
export {};
//# sourceMappingURL=automation-service.d.ts.map