import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { getConversionFunnel, getTeamPerformance, getResponseTimeAnalysis, executeCustomReport, } from './analytics-service.js';
function defaultDateRange() {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    return { from, to };
}
export async function analyticsRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // GET /api/v1/analytics/conversion-funnel?from=&to=
    app.get('/api/v1/analytics/conversion-funnel', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from, to } = { ...defaultDateRange(), ...query };
            const result = await getConversionFunnel(orgId, from, to);
            return result;
        }
        catch (err) {
            logger.error('[analytics] Conversion funnel error:', err);
            return reply.status(500).send({ error: 'Failed to fetch conversion funnel' });
        }
    });
    // GET /api/v1/analytics/team-performance?from=&to=
    app.get('/api/v1/analytics/team-performance', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from, to } = { ...defaultDateRange(), ...query };
            const result = await getTeamPerformance(orgId, from, to);
            return result;
        }
        catch (err) {
            logger.error('[analytics] Team performance error:', err);
            return reply.status(500).send({ error: 'Failed to fetch team performance' });
        }
    });
    // GET /api/v1/analytics/response-time?from=&to=
    app.get('/api/v1/analytics/response-time', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const query = request.query;
            const { from, to } = { ...defaultDateRange(), ...query };
            const result = await getResponseTimeAnalysis(orgId, from, to);
            return result;
        }
        catch (err) {
            logger.error('[analytics] Response time error:', err);
            return reply.status(500).send({ error: 'Failed to fetch response time' });
        }
    });
    // POST /api/v1/analytics/custom — body: ReportConfig
    app.post('/api/v1/analytics/custom', async (request, reply) => {
        try {
            const { orgId } = request.user;
            const config = request.body;
            if (!config.metrics?.length || !config.groupBy || !config.dateRange) {
                return reply.status(400).send({ error: 'metrics, groupBy, and dateRange are required' });
            }
            const result = await executeCustomReport(orgId, config);
            return result;
        }
        catch (err) {
            logger.error('[analytics] Custom report error:', err);
            return reply.status(500).send({ error: 'Failed to execute custom report' });
        }
    });
}
//# sourceMappingURL=analytics-routes.js.map