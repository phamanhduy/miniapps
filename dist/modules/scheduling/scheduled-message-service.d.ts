export declare class ScheduledMessageService {
    /**
     * Schedule a message for one or multiple contacts
     */
    schedule(params: {
        orgId: string;
        contactIds: string[];
        zaloAccountId: string;
        type: 'text' | 'block';
        content?: string;
        blockId?: string;
        scheduledAt: Date;
    }): Promise<{
        id: string;
        orgId: string;
        contactId: string;
        zaloAccountId: string;
        type: "text" | "block";
        content: string | undefined;
        blockId: string | undefined;
        scheduledAt: Date;
        status: string;
        createdAt: Date;
    }[]>;
    /**
     * Get pending messages due for execution
     */
    getDueMessages(limit?: number): Promise<{
        content: string | null;
        status: string;
        id: string;
        createdAt: Date | null;
        updatedAt: Date | null;
        orgId: string;
        zaloAccountId: string;
        contactId: string;
        type: string;
        blockId: string | null;
        scheduledAt: Date;
        sentAt: Date | null;
        errorMessage: string | null;
        zaloAccount: {
            status: string;
            id: string;
            createdAt: Date | null;
            orgId: string;
            ownerUserId: string;
            zaloUid: string | null;
            displayName: string | null;
            avatarUrl: string | null;
            phone: string | null;
            sessionData: unknown;
            lastConnectedAt: Date | null;
        };
        contact: {
            status: string | null;
            id: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            orgId: string;
            email: string | null;
            fullName: string | null;
            zaloUid: string | null;
            avatarUrl: string | null;
            phone: string | null;
            source: string | null;
            sourceDate: Date | null;
            firstContactDate: Date | null;
            nextAppointment: Date | null;
            assignedUserId: string | null;
            notes: string | null;
            tags: unknown;
            metadata: unknown;
            leadScore: number;
            lastActivity: Date | null;
            mergedInto: string | null;
            zaloAccountId: string | null;
            diseaseCode: string | null;
            diseaseName: string | null;
        };
    }[]>;
    /**
     * Execute a single scheduled message
     */
    executeMessage(messageId: string): Promise<void>;
}
export declare const scheduledMessageService: ScheduledMessageService;
//# sourceMappingURL=scheduled-message-service.d.ts.map