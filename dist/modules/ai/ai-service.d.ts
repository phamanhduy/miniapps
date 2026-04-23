export type AiTaskType = 'reply_draft' | 'summary' | 'sentiment';
export declare function getAiConfig(orgId: string): Promise<{
    provider: any;
    model: any;
    enabled: any;
    maxDaily: number;
    availableProviders: Omit<import("./provider-registry.js").ProviderDef, "authToken">[];
    hasAnthropicKey: boolean;
    hasGeminiKey: boolean;
}>;
export declare function updateAiConfig(orgId: string, input: {
    provider?: string;
    model?: string;
    maxDaily?: number;
    enabled?: boolean;
}): Promise<{
    success: boolean;
}>;
export declare function getAiUsage(orgId: string): Promise<{
    usedToday: number;
    maxDaily: number;
    remaining: number;
    enabled: any;
}>;
export declare function generateAiOutput(input: {
    orgId: string;
    conversationId: string;
    type: AiTaskType;
    messageId?: string;
}): Promise<{
    label: "neutral" | "positive" | "negative";
    confidence: number;
    reason: string;
} | {
    content: string;
    confidence: number;
}>;
//# sourceMappingURL=ai-service.d.ts.map