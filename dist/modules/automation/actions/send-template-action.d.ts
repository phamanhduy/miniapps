export declare function sendTemplateAction(input: {
    templateId: string;
    orgId: string;
    conversationId: string;
    zaloAccountId: string;
    threadId: string | null;
    threadType: string;
    context: {
        org?: {
            id: string;
            name: string | null;
        } | null;
        contact?: {
            id: string;
            fullName: string | null;
            phone: string | null;
            status: string | null;
        } | null;
        conversation?: {
            id: string;
        } | null;
    };
}): Promise<{
    content: string | null;
    contentType: string;
    id: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    sentAt: Date;
    conversationId: string;
    zaloMsgId: string | null;
    senderType: string;
    senderUid: string | null;
    senderName: string | null;
    senderAvatar: string | null;
    attachments: unknown;
    isDeleted: boolean;
    deletedAt: Date | null;
    repliedByUserId: string | null;
    rawZaloMsg: string | null;
} | null | undefined>;
//# sourceMappingURL=send-template-action.d.ts.map