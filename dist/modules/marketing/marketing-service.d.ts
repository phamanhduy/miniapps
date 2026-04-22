export declare class MarketingService {
    private activeJobs;
    runCampaign(campaignId: string): Promise<void>;
    getFilteredContacts(orgId: string, filters: any): Promise<{
        status: string | null;
        id: string;
        createdAt: Date | null;
        updatedAt: Date | null;
        orgId: string;
        email: string | null;
        fullName: string | null;
        zaloUid: string | null;
        avatarUrl: string | null;
        phone: string | null;
        source: string | null;
        sourceDate: Date | null;
        firstContactDate: Date | null;
        nextAppointment: Date | null;
        assignedUserId: string | null;
        notes: string | null;
        tags: unknown;
        metadata: unknown;
        leadScore: number;
        lastActivity: Date | null;
        mergedInto: string | null;
        zaloAccountId: string | null;
        diseaseCode: string | null;
        diseaseName: string | null;
    }[]>;
    private sendMessageToContact;
}
export declare const marketingService: MarketingService;
//# sourceMappingURL=marketing-service.d.ts.map