/**
 * ZaloAccountPool — singleton that manages live Zalo SDK instances.
 * Handles QR login, session reconnect, message listener lifecycle,
 * and credential persistence to the database.
 *
 * Note: zca-js is imported via createRequire because its TypeScript
 * declarations don't expose named exports in ESM mode.
 */
import { createRequire } from 'module';
import { db } from '../../shared/database/db.js';
import { zaloAccounts } from '../../shared/database/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../shared/utils/logger.js';
import { attachZaloListener } from './zalo-listener-factory.js';
import { emitWebhook } from '../api/webhook-service.js';
// zca-js has no reliable ESM type exports — load via CJS interop
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Zalo } = require('zca-js');
class ZaloAccountPool {
    instances = new Map();
    io = null;
    // Shared user-info cache passed into each listener context
    userInfoCache = new Map();
    // Circuit breaker: track disconnect timestamps per account
    disconnectHistory = new Map();
    setIO(io) {
        this.io = io;
    }
    // Initiate QR-based login; emits QR events to frontend via Socket.IO
    async loginQR(accountId) {
        const zalo = new Zalo({ logging: false });
        this.instances.set(accountId, { zalo, api: null, status: 'qr_pending', lastActivity: new Date() });
        try {
            const api = await zalo.loginQR({}, (event) => {
                switch (event.type) {
                    case 0: // QRCodeGenerated
                        this.io?.to(`account:${accountId}`).emit('zalo:qr', { accountId, qrImage: event.data.image });
                        break;
                    case 1: // QRCodeExpired
                        this.io?.to(`account:${accountId}`).emit('zalo:qr-expired', { accountId });
                        event.actions?.retry();
                        break;
                    case 2: // QRCodeScanned
                        this.io?.to(`account:${accountId}`).emit('zalo:scanned', {
                            accountId,
                            displayName: event.data.display_name,
                            avatar: event.data.avatar,
                        });
                        break;
                    case 4: // GotLoginInfo
                        this.saveCredentials(accountId, {
                            cookie: event.data.cookie,
                            imei: event.data.imei,
                            userAgent: event.data.userAgent,
                        });
                        break;
                }
            });
            const instance = this.instances.get(accountId);
            instance.api = api;
            instance.status = 'connected';
            instance.lastActivity = new Date();
            const ownId = await api.getOwnId();
            instance.zaloUid = ownId;
            // Fetch own profile info for avatar
            try {
                const userInfo = await api.getUserInfo(ownId);
                const profiles = userInfo?.changed_profiles || {};
                const profile = profiles[ownId] || profiles[`${ownId}_0`];
                if (profile?.avatar) {
                    await db.update(zaloAccounts)
                        .set({
                        avatarUrl: profile.avatar,
                        displayName: profile.zaloName || profile.zalo_name || profile.displayName || instance.displayName
                    })
                        .where(eq(zaloAccounts.id, accountId));
                }
            }
            catch { }
            this.attachListener(accountId, api);
            this.io?.emit('zalo:connected', { accountId, zaloUid: ownId });
            await this.updateAccountDB(accountId, 'connected', ownId);
            // Emit webhook
            const acc = await db.query.zaloAccounts.findFirst({
                where: eq(zaloAccounts.id, accountId),
                columns: { orgId: true }
            });
            if (acc)
                emitWebhook(acc.orgId, 'zalo.connected', { accountId });
        }
        catch (err) {
            const instance = this.instances.get(accountId);
            if (instance)
                instance.status = 'disconnected';
            this.io?.emit('zalo:error', { accountId, error: String(err) });
            throw err;
        }
    }
    // Reconnect using previously saved session credentials
    async reconnect(accountId, credentials) {
        const zalo = new Zalo({ logging: false });
        this.instances.set(accountId, { zalo, api: null, status: 'connecting', lastActivity: new Date() });
        try {
            const api = await zalo.login({
                cookie: credentials.cookie,
                imei: credentials.imei,
                userAgent: credentials.userAgent,
            });
            const instance = this.instances.get(accountId);
            instance.api = api;
            instance.status = 'connected';
            instance.lastActivity = new Date();
            const ownId = await api.getOwnId();
            instance.zaloUid = ownId;
            // Fetch own profile info for avatar
            try {
                const userInfo = await api.getUserInfo(ownId);
                const profiles = userInfo?.changed_profiles || {};
                const profile = profiles[ownId] || profiles[`${ownId}_0`];
                if (profile?.avatar) {
                    await db.update(zaloAccounts)
                        .set({
                        avatarUrl: profile.avatar,
                        displayName: profile.zaloName || profile.zalo_name || profile.displayName || instance.displayName
                    })
                        .where(eq(zaloAccounts.id, accountId));
                }
            }
            catch { }
            this.attachListener(accountId, api);
            await this.updateAccountDB(accountId, 'connected', ownId);
            this.io?.emit('zalo:connected', { accountId, zaloUid: ownId });
            const acc = await db.query.zaloAccounts.findFirst({
                where: eq(zaloAccounts.id, accountId),
                columns: { orgId: true }
            });
            if (acc)
                emitWebhook(acc.orgId, 'zalo.connected', { accountId });
        }
        catch (err) {
            const instance = this.instances.get(accountId);
            if (instance)
                instance.status = 'disconnected';
            await this.updateAccountDB(accountId, 'qr_pending', null);
            this.io?.emit('zalo:reconnect-failed', { accountId, error: String(err) });
        }
    }
    // Delegate listener setup to zalo-listener-factory
    attachListener(accountId, api) {
        attachZaloListener({
            accountId,
            api,
            io: this.io,
            userInfoCache: this.userInfoCache,
            onDisconnected: (id) => {
                const inst = this.instances.get(id);
                if (inst)
                    inst.status = 'disconnected';
                this.updateAccountDB(id, 'disconnected', null);
                // Emit webhook for disconnect
                db.query.zaloAccounts.findFirst({
                    where: eq(zaloAccounts.id, id),
                    columns: { orgId: true }
                }).then((acc) => {
                    if (acc)
                        emitWebhook(acc.orgId, 'zalo.disconnected', { accountId: id });
                }).catch(() => { });
                // Circuit breaker: track disconnect count per account
                const now = Date.now();
                const key = `dc_${id}`;
                const history = (this.disconnectHistory.get(key) || []).filter(t => now - t < 5 * 60_000);
                history.push(now);
                this.disconnectHistory.set(key, history);
                if (history.length >= 5) {
                    // >5 disconnects in 5 min → stop reconnecting, require QR re-login
                    logger.error(`[zalo:${id}] Circuit breaker: ${history.length} disconnects in 5 min — stopping auto-reconnect. QR re-login required.`);
                    this.updateAccountDB(id, 'qr_pending', null);
                    this.io?.emit('zalo:reconnect-failed', { accountId: id, error: 'Session không ổn định, cần đăng nhập QR lại' });
                    this.disconnectHistory.delete(key);
                    return; // DON'T reconnect
                }
                // Normal auto-reconnect after 30 seconds
                setTimeout(() => this.autoReconnect(id), 30_000);
            },
        });
    }
    // Persist session credentials to DB
    saveCredentials(accountId, credentials) {
        db.update(zaloAccounts)
            .set({ sessionData: credentials })
            .where(eq(zaloAccounts.id, accountId))
            .catch((err) => logger.error(`[zalo:${accountId}] saveCredentials error:`, err));
    }
    // Sync account status and zaloUid to DB
    async updateAccountDB(accountId, status, zaloUid) {
        try {
            await db.update(zaloAccounts)
                .set({
                status,
                ...(zaloUid !== null ? { zaloUid } : {}),
                ...(status === 'connected' ? { lastConnectedAt: new Date() } : {}),
            })
                .where(eq(zaloAccounts.id, accountId));
        }
        catch (err) {
            logger.error(`[zalo:${accountId}] updateAccountDB error:`, err);
        }
    }
    // Auto-reconnect using saved session from DB
    async autoReconnect(accountId) {
        const inst = this.instances.get(accountId);
        // Skip if already reconnected or manually disconnected
        if (inst?.status === 'connected')
            return;
        try {
            const account = await db.query.zaloAccounts.findFirst({
                where: eq(zaloAccounts.id, accountId),
                columns: { sessionData: true },
            });
            const session = account?.sessionData;
            if (session?.imei) {
                logger.info(`[zalo:${accountId}] Auto-reconnecting...`);
                await this.reconnect(accountId, session);
            }
            else {
                logger.warn(`[zalo:${accountId}] No saved session, cannot auto-reconnect`);
                this.io?.emit('zalo:reconnect-failed', { accountId, error: 'No saved session' });
            }
        }
        catch (err) {
            logger.error(`[zalo:${accountId}] Auto-reconnect failed:`, err);
            // Retry again in 2 minutes
            setTimeout(() => this.autoReconnect(accountId), 120_000);
        }
    }
    // Stop listener and remove from pool
    disconnect(accountId) {
        const instance = this.instances.get(accountId);
        if (instance?.api?.listener) {
            try {
                instance.api.listener.stop();
            }
            catch (err) {
                logger.warn(`[zalo:${accountId}] Error stopping listener:`, err);
            }
        }
        this.instances.delete(accountId);
    }
    getStatus(accountId) {
        return this.instances.get(accountId)?.status ?? 'disconnected';
    }
    getAllStatuses() {
        const statuses = {};
        for (const [id, inst] of this.instances)
            statuses[id] = inst.status;
        return statuses;
    }
    // Return raw API instance for direct SDK calls (e.g. public API send message)
    getApi(accountId) {
        const inst = this.instances.get(accountId);
        return inst?.status === 'connected' ? inst.api : null;
    }
    getInstance(accountId) {
        return this.instances.get(accountId);
    }
}
export const zaloPool = new ZaloAccountPool();
//# sourceMappingURL=zalo-pool.js.map