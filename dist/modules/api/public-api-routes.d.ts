/**
 * public-api-routes.ts — External REST API authenticated via API key (X-Api-Key header).
 * Provides read/write access to contacts, conversations, appointments, and message sending.
 * All routes prefixed /api/public/ — no JWT required, orgId injected from API key lookup.
 */
import type { FastifyInstance } from 'fastify';
export declare function publicApiRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=public-api-routes.d.ts.map