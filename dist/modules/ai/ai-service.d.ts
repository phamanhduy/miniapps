export type AiTaskType = 'reply_draft' | 'summary' | 'sentiment';
export declare function getAiConfig(orgId: string): Promise<{
    hasAnthropicKey: boolean;
    hasGeminiKey: boolean;
    availableProviders: Omit<import("./provider-registry.js").ProviderDef, "authToken">[];
    id?: string | undefined;
    createdAt?: Date | null | undefined;
    updatedAt?: Date | null | undefined;
    orgId?: string | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    maxDaily?: number | undefined;
    enabled?: boolean | undefined;
}>;
export declare function updateAiConfig(orgId: string, input: {
    provider?: string;
    model?: string;
    maxDaily?: number;
    enabled?: boolean;
}): Promise<import("better-sqlite3").RunResult>;
export declare function getAiUsage(orgId: string): Promise<{
    usedToday: number;
    maxDaily: number;
    remaining: number;
    enabled: boolean;
}>;
export declare function generateAiOutput(input: {
    orgId: string;
    conversationId: string;
    type: AiTaskType;
    messageId?: string;
}): Promise<{
    label: "positive" | "negative" | "neutral";
    confidence: number;
    reason: string;
} | {
    content: string;
    confidence: number;
}>;
//# sourceMappingURL=ai-service.d.ts.map