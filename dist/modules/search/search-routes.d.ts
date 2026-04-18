/**
 * Global search routes — searches contacts, messages, and appointments by keyword.
 * Requires minimum 2 characters to avoid expensive full-table scans.
 */
import type { FastifyInstance } from 'fastify';
export declare function searchRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=search-routes.d.ts.map