export interface JwtPayload {
    id: string;
    email: string;
    fullName: string;
    role: string;
    orgId: string;
}
export declare function checkSetupStatus(): Promise<{
    needsSetup: boolean;
}>;
export declare function setup(orgName: string, fullName: string, email: string, password: string): Promise<JwtPayload>;
export declare function login(email: string, password: string): Promise<JwtPayload>;
export declare function getProfile(userId: string): Promise<{
    id: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    orgId: string;
    teamId: string | null;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    org: {
        name: string;
        id: string;
        createdAt: Date | null;
        updatedAt: Date | null;
    };
}>;
//# sourceMappingURL=auth-service.d.ts.map