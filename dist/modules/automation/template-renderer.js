const TEMPLATE_VARIABLES = {
    'contact.fullName': (context) => context.contact?.fullName ?? '',
    'contact.phone': (context) => context.contact?.phone ?? '',
    'contact.status': (context) => context.contact?.status ?? '',
    'conversation.id': (context) => context.conversation?.id ?? '',
    'org.name': (context) => context.org?.name ?? '',
};
export function renderMessageTemplate(content, context) {
    return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
        const resolver = TEMPLATE_VARIABLES[token];
        return resolver ? resolver(context) : '';
    });
}
//# sourceMappingURL=template-renderer.js.map