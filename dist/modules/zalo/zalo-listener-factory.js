import { logger } from '../../shared/utils/logger.js';
import { handleIncomingMessage, handleMessageUndo } from '../chat/message-handler.js';
import { detectContentType, updateContactAvatar } from './zalo-message-helpers.js';
const USER_INFO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Fetch zaloName + avatar from API with a per-pool in-memory cache
async function resolveZaloName(api, uid, cache) {
    const cached = cache.get(uid);
    if (cached && Date.now() - cached.cachedAt < USER_INFO_CACHE_TTL_MS) {
        return { zaloName: cached.zaloName, avatar: cached.avatar };
    }
    try {
        const result = await api.getUserInfo(uid);
        const profiles = result?.changed_profiles || {};
        const profile = profiles[uid] || profiles[`${uid}_0`];
        if (profile) {
            const entry = {
                zaloName: profile.zaloName ||
                    profile.zalo_name ||
                    profile.displayName ||
                    profile.display_name ||
                    '',
                avatar: profile.avatar || '',
                phone: profile.phoneNumber || '',
                cachedAt: Date.now(),
            };
            cache.set(uid, entry);
            return { zaloName: entry.zaloName, avatar: entry.avatar };
        }
    }
    catch (err) {
        logger.warn(`[zalo] getUserInfo failed for ${uid}:`, err);
    }
    return { zaloName: '', avatar: '' };
}
// Fetch group display name from the zca-js API
async function resolveGroupName(api, groupId) {
    try {
        const result = await api.getGroupInfo(groupId);
        const info = result?.gridInfoMap?.[groupId];
        return info?.name || '';
    }
    catch (err) {
        logger.warn(`[zalo] getGroupInfo failed for ${groupId}:`, err);
        return '';
    }
}
/**
 * Attach all zca-js listener events for the given account.
 * Calls listener.start() with retryOnClose at the end.
 */
export function attachZaloListener(ctx) {
    const { accountId, api, io, userInfoCache, onDisconnected } = ctx;
    const listener = api.listener;
    listener.on('connected', () => {
        logger.info(`[zalo:${accountId}] Listener connected`);
    });
    listener.on('message', async (message) => {
        try {
            // ThreadType in zca-js: 0 = User, 1 = Group
            const isGroup = message.type === 1;
            const senderUid = String(message.data?.uidFrom || '');
            // Resolve display name — prefer zaloName from API over dName
            let senderName = message.data?.dName || '';
            if (!message.isSelf && senderUid && api.getUserInfo) {
                const userInfo = await resolveZaloName(api, senderUid, userInfoCache);
                if (userInfo.zaloName)
                    senderName = userInfo.zaloName;
                if (userInfo.avatar)
                    updateContactAvatar(senderUid, userInfo.avatar);
            }
            // Resolve group name for group threads
            let groupName;
            if (isGroup && message.threadId) {
                groupName = await resolveGroupName(api, message.threadId);
            }
            const rawContent = message.data?.content;
            const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent || '');
            const contentType = detectContentType(message.data?.msgType, rawContent);
            const result = await handleIncomingMessage({
                accountId,
                senderUid,
                senderName,
                content,
                contentType,
                msgId: String(message.data?.msgId || ''),
                timestamp: parseInt(message.data?.ts || String(Date.now())),
                isSelf: message.isSelf || false,
                threadId: message.threadId || '',
                threadType: isGroup ? 'group' : 'user',
                groupName,
                attachments: [],
            });
            if (result) {
                io?.emit('chat:message', {
                    accountId,
                    message: result.message,
                    conversationId: result.conversationId,
                });
            }
        }
        catch (err) {
            logger.error(`[zalo:${accountId}] Message handler error:`, err);
        }
    });
    listener.on('undo', async (data) => {
        const msgId = data.data?.msgId || data.msgId;
        if (msgId) {
            await handleMessageUndo(accountId, String(msgId));
            io?.emit('chat:deleted', { accountId, msgId: String(msgId) });
        }
    });
    listener.on('closed', (code, reason) => {
        logger.warn(`[zalo:${accountId}] Listener closed: ${code} ${reason}`);
        onDisconnected(accountId);
        io?.emit('zalo:disconnected', { accountId, code, reason });
    });
    listener.on('error', (err) => {
        logger.error(`[zalo:${accountId}] Listener error:`, err);
    });
    listener.start({ retryOnClose: true });
}
//# sourceMappingURL=zalo-listener-factory.js.map