import { db } from '../../shared/database/db.js';
import { savedReports } from '../../shared/database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { getConversionFunnel, getTeamPerformance, getResponseTimeAnalysis, executeCustomReport, } from './analytics-service.js';
import { v4 as uuidv4 } from 'uuid';
export async function savedReportRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/saved-reports — list all for org
    app.get('/api/v1/saved-reports', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const list = await db.query.savedReports.findMany({
                where: eq(savedReports.orgId, orgId),
                orderBy: [desc(savedReports.createdAt)],
            });
            return { data: list };
        }
        catch (err) {
            logger.error('[saved-reports] List error:', err);
            return reply.status(500).send({ error: 'Failed to list saved reports' });
        }
    });
    // POST /api/v1/saved-reports — create
    app.post('/api/v1/saved-reports', async (request, reply) => {
        try {
            const { orgId, id: userId } = request.user;
            const body = request.body;
            if (!body.name || !body.type) {
                return reply.status(400).send({ error: 'name and type are required' });
            }
            const id = uuidv4();
            await db.insert(savedReports).values({
                id,
                orgId,
                name: body.name,
                type: body.type,
                config: body.config ?? {},
                createdBy: userId,
            });
            const report = await db.query.savedReports.findFirst({ where: eq(savedReports.id, id) });
            return reply.status(201).send(report);
        }
        catch (err) {
            logger.error('[saved-reports] Create error:', err);
            return reply.status(500).send({ error: 'Failed to create saved report' });
        }
    });
    // GET /api/v1/saved-reports/:id
    app.get('/api/v1/saved-reports/:id', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const report = await db.query.savedReports.findFirst({
                where: and(eq(savedReports.id, id), eq(savedReports.orgId, orgId))
            });
            if (!report)
                return reply.status(404).send({ error: 'Report not found' });
            return report;
        }
        catch (err) {
            logger.error('[saved-reports] Get error:', err);
            return reply.status(500).send({ error: 'Failed to fetch saved report' });
        }
    });
    // PUT /api/v1/saved-reports/:id
    app.put('/api/v1/saved-reports/:id', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const body = request.body;
            const existing = await db.query.savedReports.findFirst({
                where: and(eq(savedReports.id, id), eq(savedReports.orgId, orgId))
            });
            if (!existing)
                return reply.status(404).send({ error: 'Report not found' });
            await db.update(savedReports)
                .set({
                name: body.name ?? existing.name,
                config: body.config ?? existing.config,
                updatedAt: new Date()
            })
                .where(eq(savedReports.id, id));
            const updated = await db.query.savedReports.findFirst({ where: eq(savedReports.id, id) });
            return updated;
        }
        catch (err) {
            logger.error('[saved-reports] Update error:', err);
            return reply.status(500).send({ error: 'Failed to update saved report' });
        }
    });
    // DELETE /api/v1/saved-reports/:id
    app.delete('/api/v1/saved-reports/:id', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const existing = await db.query.savedReports.findFirst({
                where: and(eq(savedReports.id, id), eq(savedReports.orgId, orgId))
            });
            if (!existing)
                return reply.status(404).send({ error: 'Report not found' });
            await db.delete(savedReports).where(eq(savedReports.id, id));
            return { success: true };
        }
        catch (err) {
            logger.error('[saved-reports] Delete error:', err);
            return reply.status(500).send({ error: 'Failed to delete saved report' });
        }
    });
    // POST /api/v1/saved-reports/:id/run — execute saved report
    app.post('/api/v1/saved-reports/:id/run', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const { id } = request.params;
            const report = await db.query.savedReports.findFirst({
                where: and(eq(savedReports.id, id), eq(savedReports.orgId, orgId))
            });
            if (!report)
                return reply.status(404).send({ error: 'Report not found' });
            const configData = report.config;
            const from = configData.dateRange?.from ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            const to = configData.dateRange?.to ?? new Date().toISOString().split('T')[0];
            switch (report.type) {
                case 'conversion_funnel':
                    return await getConversionFunnel(orgId, from, to);
                case 'team_performance':
                    return await getTeamPerformance(orgId, from, to);
                case 'response_time':
                    return await getResponseTimeAnalysis(orgId, from, to);
                case 'custom':
                    return await executeCustomReport(orgId, configData);
                default:
                    return reply.status(400).send({ error: `Unknown report type: ${report.type}` });
            }
        }
        catch (err) {
            logger.error('[saved-reports] Run error:', err);
            return reply.status(500).send({ error: 'Failed to run saved report' });
        }
    });
}
//# sourceMappingURL=saved-report-routes.js.map