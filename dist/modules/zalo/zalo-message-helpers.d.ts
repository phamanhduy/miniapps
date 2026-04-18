/**
 * Map zca-js msgType string to a normalized content type label.
 * Falls back to 'text' for unrecognised types or plain-string content.
 */
export declare function detectContentType(msgType: string | undefined, content: any): string;
/**
 * Fire-and-forget: fill in a missing avatarUrl on a Contact row.
 * Only updates rows where avatarUrl is currently null.
 */
export declare function updateContactAvatar(zaloUid: string, avatarUrl: string): void;
//# sourceMappingURL=zalo-message-helpers.d.ts.map