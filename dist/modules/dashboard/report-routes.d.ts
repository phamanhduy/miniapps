/**
 * report-routes.ts — Detailed reports for messages, contacts, appointments, and Excel export.
 * All routes require JWT auth, scoped to user's orgId.
 * Sheet builders are in excel-sheet-builders.ts.
 */
import type { FastifyInstance } from 'fastify';
export declare function reportRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=report-routes.d.ts.map