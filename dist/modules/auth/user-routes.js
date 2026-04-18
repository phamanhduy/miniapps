import { db } from '../../shared/database/db.js';
import { users } from '../../shared/database/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { authMiddleware } from './auth-middleware.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/utils/logger.js';
export async function userRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/users — list all users in org
    app.get('/api/v1/users', async (request) => {
        const user = request.user;
        const allUsers = await db.query.users.findMany({
            where: eq(users.orgId, user.orgId),
            with: {
                team: {
                    columns: { id: true, name: true }
                }
            },
            orderBy: [asc(users.createdAt)],
        });
        return { users: allUsers };
    });
    // POST /api/v1/users — create user (owner/admin only)
    app.post('/api/v1/users', async (request, reply) => {
        const currentUser = request.user;
        if (!['owner', 'admin'].includes(currentUser.role)) {
            return reply.status(403).send({ error: 'Không có quyền' });
        }
        const { email, fullName, password, role = 'member', teamId } = request.body;
        if (!email || !fullName || !password) {
            return reply.status(400).send({ error: 'Email, họ tên, mật khẩu là bắt buộc' });
        }
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (existing)
            return reply.status(400).send({ error: 'Email đã tồn tại' });
        if (role === 'owner')
            return reply.status(400).send({ error: 'Không thể tạo thêm owner' });
        if (role === 'admin' && currentUser.role !== 'owner') {
            return reply.status(403).send({ error: 'Chỉ owner có thể tạo admin' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        await db.insert(users).values({
            id: userId,
            orgId: currentUser.orgId,
            email,
            fullName,
            passwordHash,
            role,
            teamId: teamId || null,
        });
        const newUser = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });
        logger.info(`User created: ${email} by ${currentUser.email}`);
        // Remove password hash from response
        if (newUser) {
            const { passwordHash: _, ...safeUser } = newUser;
            return safeUser;
        }
        return reply.status(500).send({ error: 'Failed to create user' });
    });
    // PUT /api/v1/users/:id — update user info
    app.put('/api/v1/users/:id', async (request, reply) => {
        const currentUser = request.user;
        const { id } = request.params;
        if (!['owner', 'admin'].includes(currentUser.role) && currentUser.id !== id) {
            return reply.status(403).send({ error: 'Không có quyền' });
        }
        const { fullName, email, role, teamId, isActive } = request.body;
        if (id === currentUser.id && role && role !== currentUser.role) {
            return reply.status(400).send({ error: 'Không thể thay đổi role của chính mình' });
        }
        const updateData = { updatedAt: new Date() };
        if (fullName !== undefined)
            updateData.fullName = fullName;
        if (email !== undefined)
            updateData.email = email;
        if (role !== undefined && currentUser.role === 'owner')
            updateData.role = role;
        if (teamId !== undefined)
            updateData.teamId = teamId || null;
        if (isActive !== undefined && currentUser.role === 'owner')
            updateData.isActive = isActive;
        await db.update(users)
            .set(updateData)
            .where(and(eq(users.id, id), eq(users.orgId, currentUser.orgId)));
        const updatedUser = await db.query.users.findFirst({
            where: eq(users.id, id),
        });
        if (updatedUser) {
            const { passwordHash: _, ...safeUser } = updatedUser;
            return safeUser;
        }
        return reply.status(404).send({ error: 'User not found' });
    });
    // PUT /api/v1/users/:id/password — reset password (owner/admin only)
    app.put('/api/v1/users/:id/password', async (request, reply) => {
        const currentUser = request.user;
        if (!['owner', 'admin'].includes(currentUser.role)) {
            return reply.status(403).send({ error: 'Không có quyền' });
        }
        const { id } = request.params;
        const { password } = request.body;
        if (!password || password.length < 6) {
            return reply.status(400).send({ error: 'Mật khẩu tối thiểu 6 ký tự' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await db.update(users)
            .set({ passwordHash, updatedAt: new Date() })
            .where(and(eq(users.id, id), eq(users.orgId, currentUser.orgId)));
        return { success: true };
    });
    // DELETE /api/v1/users/:id — deactivate user (owner only)
    app.delete('/api/v1/users/:id', async (request, reply) => {
        const currentUser = request.user;
        if (currentUser.role !== 'owner') {
            return reply.status(403).send({ error: 'Chỉ owner có quyền xóa nhân viên' });
        }
        const { id } = request.params;
        if (id === currentUser.id) {
            return reply.status(400).send({ error: 'Không thể xóa chính mình' });
        }
        await db.update(users)
            .set({ isActive: false, updatedAt: new Date() })
            .where(and(eq(users.id, id), eq(users.orgId, currentUser.orgId)));
        return { success: true };
    });
}
//# sourceMappingURL=user-routes.js.map