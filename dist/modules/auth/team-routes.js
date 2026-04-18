import { db } from '../../shared/database/db.js';
import { teams, users } from '../../shared/database/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { authMiddleware } from './auth-middleware.js';
import { requireRole } from './role-middleware.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/utils/logger.js';
export async function teamRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/teams — list all teams in org
    app.get('/api/v1/teams', async (request) => {
        const user = request.user;
        const allTeams = await db.query.teams.findMany({
            where: eq(teams.orgId, user.orgId),
            with: {
                users: {
                    columns: { id: true, fullName: true, email: true, role: true }
                }
            },
            orderBy: [asc(teams.createdAt)],
        });
        return { teams: allTeams };
    });
    // POST /api/v1/teams — create team (owner/admin only)
    app.post('/api/v1/teams', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        const user = request.user;
        const { name } = request.body;
        if (!name?.trim())
            return reply.status(400).send({ error: 'Tên nhóm là bắt buộc' });
        const teamId = uuidv4();
        await db.insert(teams).values({
            id: teamId,
            orgId: user.orgId,
            name: name.trim()
        });
        const team = await db.query.teams.findFirst({
            where: eq(teams.id, teamId)
        });
        logger.info(`Team created: ${name} by ${user.email}`);
        return reply.status(201).send(team);
    });
    // PUT /api/v1/teams/:id — update team name (owner/admin only)
    app.put('/api/v1/teams/:id', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const { name } = request.body;
        if (!name?.trim())
            return reply.status(400).send({ error: 'Tên nhóm là bắt buộc' });
        try {
            await db.update(teams)
                .set({ name: name.trim() })
                .where(and(eq(teams.id, id), eq(teams.orgId, user.orgId)));
            const team = await db.query.teams.findFirst({
                where: eq(teams.id, id)
            });
            if (!team)
                return reply.status(404).send({ error: 'Team not found' });
            return team;
        }
        catch (error) {
            logger.error('Failed to update team:', error);
            return reply.status(500).send({ error: 'Failed to update team' });
        }
    });
    // DELETE /api/v1/teams/:id — delete team (owner only, unassigns members first)
    app.delete('/api/v1/teams/:id', { preHandler: requireRole('owner') }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const team = await db.query.teams.findFirst({
            where: and(eq(teams.id, id), eq(teams.orgId, user.orgId))
        });
        if (!team)
            return reply.status(404).send({ error: 'Team not found' });
        // Unassign all members before deleting
        await db.update(users)
            .set({ teamId: null })
            .where(eq(users.teamId, id));
        await db.delete(teams)
            .where(eq(teams.id, id));
        logger.info(`Team deleted: ${team.name} by ${user.email}`);
        return reply.status(204).send();
    });
    // GET /api/v1/teams/:id/members — list members of a team
    app.get('/api/v1/teams/:id/members', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const team = await db.query.teams.findFirst({
            where: and(eq(teams.id, id), eq(teams.orgId, user.orgId)),
            with: {
                users: {
                    columns: { id: true, fullName: true, email: true, role: true, isActive: true }
                }
            },
        });
        if (!team)
            return reply.status(404).send({ error: 'Team not found' });
        return { members: team.users };
    });
    // POST /api/v1/teams/:id/members — assign user to team (owner/admin only)
    app.post('/api/v1/teams/:id/members', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const { userId } = request.body;
        if (!userId)
            return reply.status(400).send({ error: 'userId là bắt buộc' });
        const team = await db.query.teams.findFirst({
            where: and(eq(teams.id, id), eq(teams.orgId, user.orgId))
        });
        if (!team)
            return reply.status(404).send({ error: 'Team not found' });
        try {
            await db.update(users)
                .set({ teamId: id, updatedAt: new Date() })
                .where(and(eq(users.id, userId), eq(users.orgId, user.orgId)));
            const updatedUser = await db.query.users.findFirst({
                where: eq(users.id, userId),
                columns: { id: true, fullName: true, email: true, role: true, teamId: true }
            });
            return updatedUser;
        }
        catch (error) {
            logger.error('Failed to assign member:', error);
            return reply.status(500).send({ error: 'Failed to assign member' });
        }
    });
    // DELETE /api/v1/teams/:id/members/:userId — remove user from team (owner/admin only)
    app.delete('/api/v1/teams/:id/members/:userId', { preHandler: requireRole('owner', 'admin') }, async (request, reply) => {
        const user = request.user;
        const { id, userId } = request.params;
        const team = await db.query.teams.findFirst({
            where: and(eq(teams.id, id), eq(teams.orgId, user.orgId))
        });
        if (!team)
            return reply.status(404).send({ error: 'Team not found' });
        try {
            await db.update(users)
                .set({ teamId: null, updatedAt: new Date() })
                .where(and(eq(users.id, userId), eq(users.orgId, user.orgId), eq(users.teamId, id)));
            return { success: true };
        }
        catch (error) {
            logger.error('Failed to remove member:', error);
            return reply.status(500).send({ error: 'Failed to remove member' });
        }
    });
}
//# sourceMappingURL=team-routes.js.map