export declare class PushService {
    /**
     * Send a push notification to all devices of a user
     */
    static sendToUser(userId: string, payload: {
        title: string;
        body: string;
        url?: string;
        convId?: string;
    }): Promise<void>;
    /**
     * Send a push notification to all users in an organization
     */
    static sendToOrg(orgId: string, payload: {
        title: string;
        body: string;
        url?: string;
    }): Promise<void>;
}
//# sourceMappingURL=push-service.d.ts.map