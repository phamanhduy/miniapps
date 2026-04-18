export async function authMiddleware(request, reply) {
    try {
        await request.jwtVerify();
    }
    catch {
        reply.status(401).send({ error: 'Unauthorized' });
    }
}
//# sourceMappingURL=auth-middleware.js.map