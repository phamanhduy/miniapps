// Returns a preHandler that rejects requests unless the user has one of the specified roles
export function requireRole(...roles) {
    return async (request, reply) => {
        const user = request.user;
        if (!user || !roles.includes(user.role)) {
            return reply.status(403).send({ error: 'Không có quyền truy cập' });
        }
    };
}
//# sourceMappingURL=role-middleware.js.map