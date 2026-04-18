export declare function createAppointmentAction(input: {
    orgId: string;
    contactId: string;
    assignedUserId?: string | null;
    offsetHours?: number;
    typeLabel?: string;
    notes?: string;
}): Promise<{
    status: string;
    id: string;
    createdAt: Date | null;
    updatedAt: Date | null;
    orgId: string;
    assignedUserId: string | null;
    notes: string | null;
    contactId: string;
    appointmentDate: Date;
    appointmentTime: string | null;
    type: string | null;
    reminderSent: boolean;
} | undefined>;
//# sourceMappingURL=create-appointment-action.d.ts.map