/**
 * Auth service — handles setup, login, and profile operations.
 * Uses bcryptjs for password hashing and Fastify JWT for token signing.
 */
import bcrypt from 'bcryptjs';
import { db } from '../../shared/database/db.js';
import { users, organizations } from '../../shared/database/schema.js';
import { count, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/utils/logger.js';
// Check if any users exist — true means first-run setup is needed
export async function checkSetupStatus() {
    const [result] = await db.select({ value: count() }).from(users);
    return { needsSetup: result.value === 0 };
}
// Create the initial organization + owner user, return JWT payload
export async function setup(orgName, fullName, email, password) {
    const [existingCount] = await db.select({ value: count() }).from(users);
    if (existingCount.value > 0) {
        const err = new Error('Setup already completed');
        err.statusCode = 400;
        throw err;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // Use synchronous transaction for better-sqlite3
    const result = db.transaction((tx) => {
        const orgId = uuidv4();
        const userId = uuidv4();
        tx.insert(organizations).values({
            id: orgId,
            name: orgName
        }).run();
        tx.insert(users).values({
            id: userId,
            orgId: orgId,
            email: email.toLowerCase().trim(),
            passwordHash,
            fullName,
            role: 'owner',
        }).run();
        return { orgId, userId, email: email.toLowerCase().trim() };
    });
    logger.info(`Setup complete — org=${result.orgId}, user=${result.userId}`);
    return {
        id: result.userId,
        email: result.email,
        role: 'owner',
        orgId: result.orgId,
    };
}
// Verify credentials, return JWT payload
export async function login(email, password) {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase().trim()),
    });
    if (!user || !user.isActive) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        const err = new Error('Invalid email or password');
        err.statusCode = 401;
        throw err;
    }
    return { id: user.id, email: user.email, role: user.role, orgId: user.orgId };
}
// Return safe user profile (no password hash)
export async function getProfile(userId) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            org: true
        }
    });
    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
    }
    // Remove sensitive fields
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}
//# sourceMappingURL=auth-service.js.map