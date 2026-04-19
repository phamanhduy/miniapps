export interface IncomingMessage {
    accountId: string;
    senderUid: string;
    senderName: string;
    content: string;
    contentType: string;
    msgId: string;
    timestamp: number;
    isSelf: boolean;
    threadId: string;
    threadType: 'user' | 'group';
    groupName?: string;
    avatarUrl?: string;
    groupAvatar?: string;
    attachments?: any[];
}
export interface HandleMessageResult {
    message: any;
    conversationId: string;
    orgId: string;
    contactId: string | null;
}
export declare function handleIncomingMessage(msg: IncomingMessage): Promise<HandleMessageResult | null>;
export declare function handleMessageUndo(accountId: string, zaloMsgId: string): Promise<void>;
export declare function handleFriendRequest(accountId: string, data: any): Promise<void>;
//# sourceMappingURL=message-handler.d.ts.map