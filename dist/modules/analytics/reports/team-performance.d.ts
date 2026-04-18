export interface TeamMember {
    userId: string;
    fullName: string;
    messagesSent: number;
    contactsConverted: number;
    appointmentsCompleted: number;
    avgResponseTime: number | null;
}
export interface TeamPerformanceResult {
    users: TeamMember[];
}
export declare function getTeamPerformance(orgId: string, from: string, to: string): Promise<TeamPerformanceResult>;
//# sourceMappingURL=team-performance.d.ts.map