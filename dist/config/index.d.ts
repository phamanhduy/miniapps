/**
 * Centralized configuration loader.
 * All environment variables are read once at startup and typed here.
 */
export declare const config: {
    port: number;
    host: string;
    nodeEnv: string;
    jwtSecret: string;
    encryptionKey: string;
    databaseUrl: string;
    uploadDir: string;
    appUrl: string;
    aiDefaultProvider: string;
    aiDefaultModel: string;
    anthropicApiKey: string;
    geminiApiKey: string;
    anthropicBaseUrl: string;
    anthropicAuthToken: string;
    anthropicDefaultOpusModel: string;
    anthropicDefaultSonnetModel: string;
    anthropicDefaultHaikuModel: string;
    geminiBaseUrl: string;
    geminiAuthToken: string;
    geminiDefaultProModel: string;
    geminiDefaultFlashModel: string;
    openaiBaseUrl: string;
    openaiAuthToken: string;
    openaiDefaultGpt4oModel: string;
    openaiDefaultGpt4oMiniModel: string;
    qwenBaseUrl: string;
    qwenAuthToken: string;
    qwenDefaultPlusModel: string;
    qwenDefaultTurboModel: string;
    qwenDefaultMaxModel: string;
    kimiBaseUrl: string;
    kimiAuthToken: string;
    kimiDefaultMoonshotV1Model: string;
    isProduction: boolean;
};
//# sourceMappingURL=index.d.ts.map