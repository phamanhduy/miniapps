interface TelegramConfig {
    botToken?: string;
    chatId?: string;
}
export declare function sendTelegramNotification(orgId: string, config: TelegramConfig): Promise<{
    direction: 'export';
    recordCount: number;
    status: 'success' | 'failed';
    errorMessage?: string;
}>;
export {};
//# sourceMappingURL=telegram-bot.d.ts.map