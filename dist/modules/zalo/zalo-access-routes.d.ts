/**
 * Zalo account access control routes — manage per-user permissions on Zalo accounts.
 * Permission levels: read (view messages), chat (send messages), admin (manage account).
 * All write operations require owner/admin role.
 */
import type { FastifyInstance } from 'fastify';
export declare function zaloAccessRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=zalo-access-routes.d.ts.map