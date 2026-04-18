export type ProviderModel = {
    title: string;
    value: string;
};
export type ProviderDef = {
    id: string;
    name: string;
    baseUrl: string;
    authToken: string;
    models: ProviderModel[];
};
/** Returns providers that have an auth token AND at least one model configured */
export declare function getAvailableProviders(): Omit<ProviderDef, 'authToken'>[];
/** Returns full config (including authToken) for a single provider */
export declare function getProviderConfig(providerId: string): ProviderDef | undefined;
//# sourceMappingURL=provider-registry.d.ts.map