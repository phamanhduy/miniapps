interface Integration {
    id: string;
    orgId: string;
    type: string;
    config: unknown;
}
export declare function runSync(integration: Integration): Promise<{
    status: string;
    id: string;
    createdAt: Date | null;
    integrationId: string;
    direction: string;
    recordCount: number;
    errorMessage: string | null;
} | {
    integrationId: string;
    direction: "import" | "export";
    recordCount: number;
    status: "success" | "partial" | "failed";
    errorMessage?: string;
} | undefined>;
export {};
//# sourceMappingURL=sync-engine.d.ts.map