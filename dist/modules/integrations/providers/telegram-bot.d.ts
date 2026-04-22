interface TelegramConfig {
    botToken?: string;
    chatId?: string;
    notifyOnMessage?: boolean;
}
export declare function sendTelegramNotification(orgId: string, config: TelegramConfig): Promise<{
    direction: 'export';
    recordCount: number;
    status: 'success' | 'failed';
    errorMessage?: string;
}>;
export declare function sendInstantTelegramNotification(config: TelegramConfig, data: {
    senderName: string;
    content: string;
    conversationId: string;
    threadType: string;
    groupName?: string;
}): Promise<boolean>;
export {};
//# sourceMappingURL=telegram-bot.d.ts.map