/**
 * Role middleware — factory that returns a preHandler checking user role.
 * Usage: { preHandler: [authMiddleware, requireRole('owner', 'admin')] }
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
export declare function requireRole(...roles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
//# sourceMappingURL=role-middleware.d.ts.map