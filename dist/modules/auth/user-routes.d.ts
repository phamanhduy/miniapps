/**
 * User management routes — CRUD for users within an org.
 * All routes require authentication via authMiddleware.
 * Role-based access: owner > admin > member.
 */
import { FastifyInstance } from 'fastify';
export declare function userRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=user-routes.d.ts.map