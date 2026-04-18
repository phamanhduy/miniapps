import { authMiddleware } from '../auth/auth-middleware.js';
import { zaloPool } from './zalo-pool.js';
import { db } from '../../shared/database/db.js';
import { zaloAccounts } from '../../shared/database/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
export async function zaloRoutes(app) {
    // All routes in this plugin require auth
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/zalo-accounts — list accounts with live status from pool
    app.get('/api/v1/zalo-accounts', async (request) => {
        const user = request.user;
        const accounts = await db.query.zaloAccounts.findMany({
            where: eq(zaloAccounts.orgId, user.orgId),
            with: {
                owner: {
                    columns: { id: true, fullName: true, email: true }
                }
            },
            orderBy: [asc(zaloAccounts.createdAt)],
        });
        // Merge live status from pool
        return accounts.map((a) => ({
            ...a,
            liveStatus: zaloPool.getStatus(a.id),
        }));
    });
    // POST /api/v1/zalo-accounts — create a new account record
    app.post('/api/v1/zalo-accounts', async (request, reply) => {
        const user = request.user;
        const { displayName } = request.body ?? {};
        const id = uuidv4();
        await db.insert(zaloAccounts).values({
            id,
            orgId: user.orgId,
            ownerUserId: user.id,
            displayName: displayName ?? null,
            status: 'qr_pending',
        });
        const account = await db.query.zaloAccounts.findFirst({
            where: eq(zaloAccounts.id, id)
        });
        return reply.status(201).send(account);
    });
    // POST /api/v1/zalo-accounts/:id/login — initiate QR login
    app.post('/api/v1/zalo-accounts/:id/login', async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const account = await db.query.zaloAccounts.findFirst({
            where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
        });
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        // Fire-and-forget — QR delivered via Socket.IO
        zaloPool.loginQR(id).catch(() => {
            // errors are emitted via socket; no need to crash here
        });
        return { message: 'QR login initiated — subscribe to account:' + id + ' socket room' };
    });
    // POST /api/v1/zalo-accounts/:id/reconnect — force reconnect using saved session
    app.post('/api/v1/zalo-accounts/:id/reconnect', async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const account = await db.query.zaloAccounts.findFirst({
            where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
        });
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        const session = account.sessionData;
        if (!session?.imei) {
            return reply.status(400).send({ error: 'No saved session — please login with QR first' });
        }
        // Fire-and-forget — result emitted via Socket.IO
        zaloPool.reconnect(id, session).catch(() => { });
        return { message: 'Reconnect initiated' };
    });
    // DELETE /api/v1/zalo-accounts/:id — disconnect and delete record
    app.delete('/api/v1/zalo-accounts/:id', async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const account = await db.query.zaloAccounts.findFirst({
            where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
        });
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        zaloPool.disconnect(id);
        await db.delete(zaloAccounts).where(eq(zaloAccounts.id, id));
        return reply.status(204).send();
    });
    // GET /api/v1/zalo-accounts/:id/status — live status from pool
    app.get('/api/v1/zalo-accounts/:id/status', async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const account = await db.query.zaloAccounts.findFirst({
            where: and(eq(zaloAccounts.id, id), eq(zaloAccounts.orgId, user.orgId)),
            columns: { id: true, status: true },
        });
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        return { accountId: id, liveStatus: zaloPool.getStatus(id) };
    });
}
//# sourceMappingURL=zalo-routes.js.map