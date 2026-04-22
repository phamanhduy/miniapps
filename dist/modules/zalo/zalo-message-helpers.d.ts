/**
 * Map zca-js msgType string to a normalized content type label.
 * Falls back to 'text' for unrecognised types or plain-string content.
 */
export declare function detectContentType(msgType: string | undefined, content: any): string;
/**
 * Fire-and-forget: fill in a missing avatarUrl on a Contact row.
 */
export declare function updateContactAvatar(zaloUid: string, avatarUrl: string): void;
/**
 * Parses complex Zalo message structures (JSON objects) into readable text.
 * Especially useful for 'action' messages like polls/votes.
 */
export declare function parseComplexContent(rawContent: any): string;
/**
 * Randomizes content using spin-tax format {word1|word2|word3}
 */
export declare function applySpinTax(content: string): string;
/**
 * Personalizes a message by replacing variables and applying spin-tax
 */
export declare function personalizeMessage(content: string, contactName?: string): string;
export interface UserInfoCacheEntry {
    zaloName: string;
    avatar: string;
    phone?: string;
    isFriend?: boolean;
    cachedAt: number;
}
/**
 * Fetch user profile from API with a global in-memory cache
 */
export declare function resolveUserInfoWithCache(api: any, uid: string): Promise<{
    zaloName: string;
    avatar: string;
    phone?: string;
    isFriend?: boolean;
}>;
export interface GroupInfoCacheEntry {
    name: string;
    avatar: string;
    memberCount: number;
    metadata?: any;
    cachedAt: number;
}
/**
 * Fetch group info from API with a global in-memory cache
 */
export declare function resolveGroupInfoWithCache(api: any, groupId: string): Promise<{
    name: string;
    avatar: string;
    memberCount: number;
    metadata: any;
}>;
/**
 * Fetch group info from the zca-js API
 */
export declare function resolveGroupInfo(api: any, groupId: string): Promise<{
    name: string;
    avatar: string;
    memberCount?: number;
    metadata?: any;
}>;
import { Server } from 'socket.io';
/**
 * Update group metadata in the conversations table if it's a group thread.
 */
export declare function updateGroupMetadata(api: any, conversationId: string, threadId: string, io?: Server | null): Promise<void>;
/**
 * Sends a single message (text + optional attachments) to a Zalo UID.
 * Handles personalization and file resolution.
 */
export declare function sendMessageToZalo(api: any, contactUid: string, msg: {
    text?: string;
    attachments?: any[];
}, threadType?: number, contactName?: string, quoteData?: any): Promise<void>;
/**
 * Sends a full message block (sequence of items) to a contact.
 * Handles personalization, attachments, and sequential delivery.
 */
export declare function sendBlock(api: any, contactUid: string, blockId: string, contactName?: string, threadType?: number): Promise<void>;
/**
 * Normalizes Zalo raw content into an array of attachments.
 * Handles both images (photo) and general files.
 */
export declare function extractAttachments(msgType: string | undefined, content: any): any[];
//# sourceMappingURL=zalo-message-helpers.d.ts.map