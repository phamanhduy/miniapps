export interface AutomationTemplateContext {
    org?: {
        id: string;
        name: string | null;
    } | null;
    contact?: {
        id: string;
        fullName: string | null;
        phone: string | null;
        status: string | null;
    } | null;
    conversation?: {
        id: string;
    } | null;
}
export declare function renderMessageTemplate(content: string, context: AutomationTemplateContext): string;
//# sourceMappingURL=template-renderer.d.ts.map