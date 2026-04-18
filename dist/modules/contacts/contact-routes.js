import { db } from '../../shared/database/db.js';
import { contacts, organizations, duplicateGroups, appointments } from '../../shared/database/schema.js';
import { eq, and, or, like, desc, count, inArray, isNull } from 'drizzle-orm';
import { authMiddleware } from '../auth/auth-middleware.js';
import { logger } from '../../shared/utils/logger.js';
import { mergeContacts } from './merge-service.js';
import { runContactIntelligence } from './contact-intelligence.js';
import { runAutomationRules } from '../automation/automation-service.js';
import { v4 as uuidv4 } from 'uuid';
export async function contactRoutes(app) {
    app.addHook('preHandler', authMiddleware);
    // ── GET /api/v1/contacts — list with filters and pagination ───────────────
    app.get('/api/v1/contacts', async (request, reply) => {
        try {
            const user = request.user;
            const { page = '1', limit = '50', search = '', source = '', status = '', assignedUserId = '', } = request.query;
            let filters = and(eq(contacts.orgId, user.orgId), isNull(contacts.mergedInto));
            if (source)
                filters = and(filters, eq(contacts.source, source));
            if (status)
                filters = and(filters, eq(contacts.status, status));
            if (assignedUserId)
                filters = and(filters, eq(contacts.assignedUserId, assignedUserId));
            if (search) {
                filters = and(filters, or(like(contacts.fullName, `%${search}%`), like(contacts.phone, `%${search}%`), like(contacts.email, `%${search}%`)));
            }
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const [contactList, totalResult] = await Promise.all([
                db.query.contacts.findMany({
                    where: filters,
                    with: {
                        assignedUser: {
                            columns: { id: true, fullName: true, email: true }
                        },
                        conversations: { columns: { id: true } },
                        appointments: { columns: { id: true } },
                    },
                    orderBy: [desc(contacts.updatedAt)],
                    offset: (pageNum - 1) * limitNum,
                    limit: limitNum,
                }),
                db.select({ value: count() }).from(contacts).where(filters),
            ]);
            // Map to include counts to match frontend expectations if needed
            const mappedContacts = contactList.map(c => ({
                ...c,
                _count: {
                    conversations: c.conversations.length,
                    appointments: c.appointments.length
                }
            }));
            return { contacts: mappedContacts, total: totalResult[0].value, page: pageNum, limit: limitNum };
        }
        catch (err) {
            logger.error('[contacts] List error:', err);
            return reply.status(500).send({ error: 'Failed to fetch contacts' });
        }
    });
    // ── GET /api/v1/contacts/pipeline — kanban grouped by generic status ──────
    app.get('/api/v1/contacts/pipeline', async (request, reply) => {
        try {
            const user = request.user;
            const orgId = user.orgId;
            // Group by status
            const pipelineStats = await db.select({
                status: contacts.status,
                count: count()
            })
                .from(contacts)
                .where(and(eq(contacts.orgId, orgId), isNull(contacts.mergedInto)))
                .groupBy(contacts.status);
            const result = await Promise.all(pipelineStats.map(async (stat) => {
                const statusValue = stat.status || 'new';
                const items = await db.query.contacts.findMany({
                    where: and(eq(contacts.orgId, orgId), eq(contacts.status, statusValue), isNull(contacts.mergedInto)),
                    with: {
                        assignedUser: { columns: { id: true, fullName: true } }
                    },
                    orderBy: [desc(contacts.updatedAt)],
                    limit: 20,
                });
                return {
                    status: statusValue,
                    count: stat.count,
                    contacts: items
                };
            }));
            return { pipeline: result };
        }
        catch (err) {
            logger.error('[contacts] Pipeline error:', err);
            return reply.status(500).send({ error: 'Failed to fetch pipeline' });
        }
    });
    // ── GET /api/v1/contacts/:id — detail with appointments + conversation count
    app.get('/api/v1/contacts/:id', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const contact = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, id), eq(contacts.orgId, user.orgId)),
                with: {
                    assignedUser: { columns: { id: true, fullName: true, email: true } },
                    appointments: {
                        orderBy: [desc(appointments.appointmentDate)],
                        limit: 10
                    },
                    conversations: { columns: { id: true } }
                },
            });
            if (!contact)
                return reply.status(404).send({ error: 'Contact not found' });
            return {
                ...contact,
                _count: {
                    conversations: contact.conversations.length
                }
            };
        }
        catch (err) {
            logger.error('[contacts] Detail error:', err);
            return reply.status(500).send({ error: 'Failed to fetch contact' });
        }
    });
    // ── POST /api/v1/contacts — create new contact ────────────────────────────
    app.post('/api/v1/contacts', async (request, reply) => {
        try {
            const user = request.user;
            const body = request.body;
            const id = uuidv4();
            await db.insert(contacts).values({
                id,
                orgId: user.orgId,
                fullName: body.fullName,
                phone: body.phone,
                email: body.email,
                zaloUid: body.zaloUid,
                avatarUrl: body.avatarUrl,
                source: body.source,
                sourceDate: body.sourceDate ? new Date(body.sourceDate) : undefined,
                status: body.status ?? 'new',
                nextAppointment: body.nextAppointment ? new Date(body.nextAppointment) : undefined,
                assignedUserId: body.assignedUserId,
                notes: body.notes,
                tags: body.tags ?? [],
                metadata: body.metadata ?? {},
            });
            const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
            const org = await db.query.organizations.findFirst({
                where: eq(organizations.id, user.orgId),
                columns: { id: true, name: true },
            });
            if (contact) {
                void runAutomationRules({
                    trigger: 'contact_created',
                    orgId: user.orgId,
                    org: org,
                    contact: {
                        id: contact.id,
                        fullName: contact.fullName,
                        phone: contact.phone,
                        status: contact.status,
                        source: contact.source,
                        assignedUserId: contact.assignedUserId,
                    },
                });
            }
            return reply.status(201).send(contact);
        }
        catch (err) {
            logger.error('[contacts] Create error:', err);
            return reply.status(500).send({ error: 'Failed to create contact' });
        }
    });
    // ── PUT /api/v1/contacts/:id — update CRM fields ─────────────────────────
    app.put('/api/v1/contacts/:id', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const body = request.body;
            const existing = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, id), eq(contacts.orgId, user.orgId)),
                columns: { id: true, status: true, fullName: true, phone: true, source: true, assignedUserId: true },
            });
            if (!existing)
                return reply.status(404).send({ error: 'Contact not found' });
            const updateData = {
                updatedAt: new Date(),
                fullName: body.fullName,
                phone: body.phone,
                email: body.email,
                avatarUrl: body.avatarUrl,
                source: body.source,
                sourceDate: body.sourceDate ? new Date(body.sourceDate) : undefined,
                status: body.status,
                nextAppointment: body.nextAppointment ? new Date(body.nextAppointment) : undefined,
                assignedUserId: body.assignedUserId,
                notes: body.notes,
                tags: body.tags,
                metadata: body.metadata,
            };
            if (body.firstContactDate !== undefined) {
                updateData.firstContactDate = body.firstContactDate ? new Date(body.firstContactDate) : null;
            }
            await db.update(contacts)
                .set(updateData)
                .where(eq(contacts.id, id));
            const updated = await db.query.contacts.findFirst({
                where: eq(contacts.id, id),
                with: {
                    assignedUser: { columns: { id: true, fullName: true, email: true } },
                    appointments: { orderBy: [desc(appointments.appointmentDate)], limit: 10 },
                    conversations: { columns: { id: true } },
                },
            });
            if (updated && existing.status !== updated.status) {
                const org = await db.query.organizations.findFirst({
                    where: eq(organizations.id, user.orgId),
                    columns: { id: true, name: true },
                });
                void runAutomationRules({
                    trigger: 'status_changed',
                    orgId: user.orgId,
                    org: org,
                    contact: {
                        id: updated.id,
                        fullName: updated.fullName,
                        phone: updated.phone,
                        status: updated.status,
                        source: updated.source,
                        assignedUserId: updated.assignedUserId,
                    },
                });
            }
            if (updated) {
                return {
                    ...updated,
                    _count: {
                        conversations: updated.conversations.length
                    }
                };
            }
            return reply.status(404).send({ error: 'Contact not found' });
        }
        catch (err) {
            logger.error('[contacts] Update error:', err);
            return reply.status(500).send({ error: 'Failed to update contact' });
        }
    });
    // ── PUT /api/v1/contacts/:id/tags — update tags only ─────────────────────
    app.put('/api/v1/contacts/:id/tags', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const { tags } = request.body;
            if (!Array.isArray(tags))
                return reply.status(400).send({ error: 'tags must be an array' });
            const existing = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, id), eq(contacts.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Contact not found' });
            await db.update(contacts)
                .set({ tags, updatedAt: new Date() })
                .where(eq(contacts.id, id));
            const updated = await db.query.contacts.findFirst({ where: eq(contacts.id, id) });
            return updated;
        }
        catch (err) {
            logger.error('[contacts] Update tags error:', err);
            return reply.status(500).send({ error: 'Failed to update tags' });
        }
    });
    // ── DELETE /api/v1/contacts/:id ───────────────────────────────────────────
    app.delete('/api/v1/contacts/:id', async (request, reply) => {
        try {
            const user = request.user;
            const { id } = request.params;
            const existing = await db.query.contacts.findFirst({
                where: and(eq(contacts.id, id), eq(contacts.orgId, user.orgId)),
                columns: { id: true }
            });
            if (!existing)
                return reply.status(404).send({ error: 'Contact not found' });
            await db.delete(contacts).where(eq(contacts.id, id));
            return { success: true };
        }
        catch (err) {
            logger.error('[contacts] Delete error:', err);
            return reply.status(500).send({ error: 'Failed to delete contact' });
        }
    });
    // ── GET /api/v1/contacts/duplicates — list unresolved duplicate groups ────
    app.get('/api/v1/contacts/duplicates', async (request, reply) => {
        try {
            const user = request.user;
            const { page = '1', limit = '20', resolved = 'false' } = request.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const filters = and(eq(duplicateGroups.orgId, user.orgId), eq(duplicateGroups.resolved, resolved === 'true'));
            const [groups, totalResult] = await Promise.all([
                db.query.duplicateGroups.findMany({
                    where: filters,
                    orderBy: [desc(duplicateGroups.createdAt)],
                    offset: (pageNum - 1) * limitNum,
                    limit: limitNum,
                }),
                db.select({ value: count() }).from(duplicateGroups).where(filters),
            ]);
            // Expand contact data for each group
            const expanded = await Promise.all(groups.map(async (group) => {
                const contactIds = group.contactIds;
                const contactList = await db.query.contacts.findMany({
                    where: inArray(contacts.id, contactIds),
                    columns: {
                        id: true, fullName: true, phone: true, email: true,
                        zaloUid: true, avatarUrl: true, source: true, status: true,
                        tags: true, createdAt: true, leadScore: true, lastActivity: true,
                    },
                });
                return { ...group, contacts: contactList };
            }));
            return { groups: expanded, total: totalResult[0].value, page: pageNum, limit: limitNum };
        }
        catch (err) {
            logger.error('[contacts] Duplicates list error:', err);
            return reply.status(500).send({ error: 'Failed to fetch duplicate groups' });
        }
    });
    // ── POST /api/v1/contacts/duplicates/:groupId/merge — merge a group ──────
    app.post('/api/v1/contacts/duplicates/:groupId/merge', async (request, reply) => {
        try {
            const user = request.user;
            const { groupId } = request.params;
            const { primaryContactId } = request.body;
            if (!primaryContactId)
                return reply.status(400).send({ error: 'primaryContactId is required' });
            const group = await db.query.duplicateGroups.findFirst({
                where: and(eq(duplicateGroups.id, groupId), eq(duplicateGroups.orgId, user.orgId), eq(duplicateGroups.resolved, false)),
            });
            if (!group)
                return reply.status(404).send({ error: 'Duplicate group not found' });
            const contactIds = group.contactIds;
            const secondaryIds = contactIds.filter((id) => id !== primaryContactId);
            if (secondaryIds.length === 0)
                return reply.status(400).send({ error: 'Primary must be in the group' });
            const merged = await mergeContacts(user.orgId, user.id, primaryContactId, secondaryIds);
            // Resolve the group
            await db.update(duplicateGroups)
                .set({ resolved: true })
                .where(eq(duplicateGroups.id, groupId));
            return merged;
        }
        catch (err) {
            logger.error('[contacts] Merge error:', err);
            return reply.status(400).send({ error: err.message || 'Failed to merge contacts' });
        }
    });
    // ── POST /api/v1/contacts/intelligence/recompute — manual trigger ────────
    app.post('/api/v1/contacts/intelligence/recompute', async (request, reply) => {
        try {
            // Fire and forget — return 202 immediately
            runContactIntelligence().catch((err) => {
                logger.error('[contacts] Recompute error:', err);
            });
            return reply.status(202).send({ message: 'Intelligence recompute started' });
        }
        catch (err) {
            logger.error('[contacts] Recompute trigger error:', err);
            return reply.status(500).send({ error: 'Failed to start recompute' });
        }
    });
}
//# sourceMappingURL=contact-routes.js.map