import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
// ── Organizations ────────────────────────────────────────────────────────────
export const organizations = sqliteTable('organizations', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
export const organizationsRelations = relations(organizations, ({ many, one }) => ({
    teams: many(teams),
    users: many(users),
    zaloAccounts: many(zaloAccounts),
    contacts: many(contacts),
    aiConfig: one(aiConfigs, {
        fields: [organizations.id],
        references: [aiConfigs.orgId],
    }),
}));
// ── Teams ──────────────────────────────────────────────────────────────────
export const teams = sqliteTable('teams', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
});
export const teamsRelations = relations(teams, ({ one, many }) => ({
    org: one(organizations, {
        fields: [teams.orgId],
        references: [organizations.id],
    }),
    users: many(users),
}));
// ── Users ──────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => teams.id),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role').notNull().default('member'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
export const usersRelations = relations(users, ({ one, many }) => ({
    org: one(organizations, {
        fields: [users.orgId],
        references: [organizations.id],
    }),
    team: one(teams, {
        fields: [users.teamId],
        references: [teams.id],
    }),
    zaloAccounts: many(zaloAccounts),
    zaloAccess: many(zaloAccountAccess),
    assignedContacts: many(contacts),
    appointments: many(appointments),
}));
// ── Zalo Accounts ─────────────────────────────────────────────────────────────
export const zaloAccounts = sqliteTable('zalo_accounts', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    ownerUserId: text('owner_user_id').notNull().references(() => users.id),
    zaloUid: text('zalo_uid').unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    status: text('status').notNull().default('disconnected'),
    sessionData: text('session_data', { mode: 'json' }),
    lastConnectedAt: integer('last_connected_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
});
export const zaloAccountsRelations = relations(zaloAccounts, ({ one, many }) => ({
    org: one(organizations, {
        fields: [zaloAccounts.orgId],
        references: [organizations.id],
    }),
    owner: one(users, {
        fields: [zaloAccounts.ownerUserId],
        references: [users.id],
    }),
    access: many(zaloAccountAccess),
    conversations: many(conversations),
}));
// ── Zalo Account Access ───────────────────────────────────────────────────────
export const zaloAccountAccess = sqliteTable('zalo_account_access', {
    id: text('id').primaryKey(),
    zaloAccountId: text('zalo_account_id').notNull().references(() => zaloAccounts.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull().default('read'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
}, (table) => ({
    unq: uniqueIndex('zalo_account_access_unq').on(table.zaloAccountId, table.userId),
}));
export const zaloAccountAccessRelations = relations(zaloAccountAccess, ({ one }) => ({
    zaloAccount: one(zaloAccounts, {
        fields: [zaloAccountAccess.zaloAccountId],
        references: [zaloAccounts.id],
    }),
    user: one(users, {
        fields: [zaloAccountAccess.userId],
        references: [users.id],
    }),
}));
// ── Contacts ─────────────────────────────────────────────────────────────────
export const contacts = sqliteTable('contacts', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    zaloUid: text('zalo_uid'),
    phone: text('phone'),
    email: text('email'),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    source: text('source'),
    sourceDate: integer('source_date', { mode: 'timestamp_ms' }),
    firstContactDate: integer('first_contact_date', { mode: 'timestamp_ms' }),
    status: text('status').default('new'),
    nextAppointment: integer('next_appointment', { mode: 'timestamp_ms' }),
    assignedUserId: text('assigned_user_id').references(() => users.id),
    notes: text('notes'),
    tags: text('tags', { mode: 'json' }).default('[]'),
    metadata: text('metadata', { mode: 'json' }).default('{}'),
    leadScore: integer('lead_score').notNull().default(0),
    lastActivity: integer('last_activity', { mode: 'timestamp_ms' }),
    mergedInto: text('merged_into'),
    diseaseCode: text('disease_code'), // Optional extra fields from later conversation
    diseaseName: text('disease_name'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
}, (table) => ({
    phoneIdx: index('contacts_phone_idx').on(table.orgId, table.phone),
    zaloUidIdx: index('contacts_zalo_uid_idx').on(table.orgId, table.zaloUid),
    mergedIdx: index('contacts_merged_idx').on(table.orgId, table.mergedInto),
}));
export const contactsRelations = relations(contacts, ({ one, many }) => ({
    org: one(organizations, {
        fields: [contacts.orgId],
        references: [organizations.id],
    }),
    assignedUser: one(users, {
        fields: [contacts.assignedUserId],
        references: [users.id],
    }),
    conversations: many(conversations),
    appointments: many(appointments),
}));
// ── Conversations ────────────────────────────────────────────────────────────
export const conversations = sqliteTable('conversations', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    zaloAccountId: text('zalo_account_id').notNull().references(() => zaloAccounts.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contacts.id),
    threadType: text('thread_type').notNull().default('user'),
    externalThreadId: text('external_thread_id'),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' }),
    unreadCount: integer('unread_count').notNull().default(0),
    isReplied: integer('is_replied', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
}, (table) => ({
    unq: uniqueIndex('conversations_unq').on(table.zaloAccountId, table.externalThreadId),
}));
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    org: one(organizations, {
        fields: [conversations.orgId],
        references: [organizations.id],
    }),
    zaloAccount: one(zaloAccounts, {
        fields: [conversations.zaloAccountId],
        references: [zaloAccounts.id],
    }),
    contact: one(contacts, {
        fields: [conversations.contactId],
        references: [contacts.id],
    }),
    messages: many(messages),
}));
// ── Messages ─────────────────────────────────────────────────────────────────
export const messages = sqliteTable('messages', {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    zaloMsgId: text('zalo_msg_id'),
    senderType: text('sender_type').notNull(),
    senderUid: text('sender_uid'),
    senderName: text('sender_name'),
    content: text('content'),
    contentType: text('content_type').notNull().default('text'),
    attachments: text('attachments', { mode: 'json' }).default('[]'),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull(),
    repliedByUserId: text('replied_by_user_id').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
    repliedBy: one(users, {
        fields: [messages.repliedByUserId],
        references: [users.id],
    }),
}));
// ── Appointments ────────────────────────────────────────────────────────────
export const appointments = sqliteTable('appointments', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    assignedUserId: text('assigned_user_id').references(() => users.id),
    appointmentDate: integer('appointment_date', { mode: 'timestamp_ms' }).notNull(),
    appointmentTime: text('appointment_time'),
    type: text('type'),
    status: text('status').notNull().default('scheduled'),
    notes: text('notes'),
    reminderSent: integer('reminder_sent', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
export const appointmentsRelations = relations(appointments, ({ one }) => ({
    org: one(organizations, {
        fields: [appointments.orgId],
        references: [organizations.id],
    }),
    contact: one(contacts, {
        fields: [appointments.contactId],
        references: [contacts.id],
    }),
    assignedUser: one(users, {
        fields: [appointments.assignedUserId],
        references: [users.id],
    }),
}));
// ── Activity Logs ────────────────────────────────────────────────────────────
export const activityLogs = sqliteTable('activity_logs', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    details: text('details', { mode: 'json' }).default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
});
// ── Daily Message Stats ──────────────────────────────────────────────────────
export const dailyMessageStats = sqliteTable('daily_message_stats', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    zaloAccountId: text('zalo_account_id').notNull().references(() => zaloAccounts.id, { onDelete: 'cascade' }),
    statDate: integer('stat_date', { mode: 'timestamp_ms' }).notNull(),
    messagesSent: integer('messages_sent').notNull().default(0),
    messagesReceived: integer('messages_received').notNull().default(0),
    messagesUnread: integer('messages_unread').notNull().default(0),
    messagesUnreplied: integer('messages_unreplied').notNull().default(0),
    avgResponseTimeSeconds: integer('avg_response_time_seconds'),
}, (table) => ({
    unq: uniqueIndex('daily_message_stats_unq').on(table.userId, table.zaloAccountId, table.statDate),
}));
// ── App Settings ────────────────────────────────────────────────────────────
export const appSettings = sqliteTable('app_settings', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    settingKey: text('setting_key').notNull(),
    valuePlain: text('value_plain'),
    valueEncrypted: text('value_encrypted'), // Blob in SQLite if needed, but text is fine for base64
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
}, (table) => ({
    unq: uniqueIndex('app_settings_unq').on(table.orgId, table.settingKey),
}));
// ── Saved Reports ────────────────────────────────────────────────────────────
export const savedReports = sqliteTable('saved_reports', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    config: text('config', { mode: 'json' }).default('{}'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
// ── Integrations ─────────────────────────────────────────────────────────────
export const integrations = sqliteTable('integrations', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // google_sheets, telegram, facebook, zapier
    name: text('name').notNull().default(''),
    config: text('config', { mode: 'json' }).default('{}'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    lastSyncAt: integer('last_sync_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
export const integrationsRelations = relations(integrations, ({ one, many }) => ({
    org: one(organizations, {
        fields: [integrations.orgId],
        references: [organizations.id],
    }),
    syncLogs: many(syncLogs),
}));
// ── Sync Logs ────────────────────────────────────────────────────────────────
export const syncLogs = sqliteTable('sync_logs', {
    id: text('id').primaryKey(),
    integrationId: text('integration_id').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
    direction: text('direction').notNull(), // import, export
    recordCount: integer('record_count').notNull().default(0),
    status: text('status').notNull(), // success, partial, failed
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
});
export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
    integration: one(integrations, {
        fields: [syncLogs.integrationId],
        references: [integrations.id],
    }),
}));
// ── Duplicate Groups ─────────────────────────────────────────────────────────
export const duplicateGroups = sqliteTable('duplicate_groups', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    contactIds: text('contact_ids', { mode: 'json' }).notNull(), // Array of IDs
    matchType: text('match_type').notNull(), // phone, zalo_uid, name
    confidence: real('confidence').notNull().default(1.0),
    resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
}, (table) => ({
    resolvedIdx: index('duplicate_groups_resolved_idx').on(table.orgId, table.resolved),
}));
// ── Automation Rules ─────────────────────────────────────────────────────────
export const automationRules = sqliteTable('automation_rules', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    trigger: text('trigger').notNull(),
    conditions: text('conditions', { mode: 'json' }).default('[]'),
    actions: text('actions', { mode: 'json' }).default('[]'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    priority: integer('priority').notNull().default(0),
    runCount: integer('run_count').notNull().default(0),
    lastRunAt: integer('last_run_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
}, (table) => ({
    triggerIdx: index('automation_rules_trigger_idx').on(table.orgId, table.trigger, table.enabled, table.priority),
}));
// ── Message Templates ────────────────────────────────────────────────────────
export const messageTemplates = sqliteTable('message_templates', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    content: text('content').notNull(),
    category: text('category'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
}, (table) => ({
    catIdx: index('message_templates_cat_idx').on(table.orgId, table.category),
}));
// ── AI Config & Suggestions ──────────────────────────────────────────────────
export const aiConfigs = sqliteTable('ai_configs', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().unique().references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('anthropic'),
    model: text('model').notNull().default('claude-sonnet-4-6'),
    maxDaily: integer('max_daily').notNull().default(500),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql `0`),
});
export const aiSuggestions = sqliteTable('ai_suggestions', {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id'),
    type: text('type').notNull(),
    content: text('content').notNull(),
    confidence: real('confidence').notNull(),
    accepted: integer('accepted', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql `(strftime('%s', 'now') * 1000)`),
}, (table) => ({
    orgIdx: index('ai_suggestions_org_idx').on(table.orgId, table.createdAt),
    convIdx: index('ai_suggestions_conv_idx').on(table.conversationId, table.createdAt),
}));
//# sourceMappingURL=schema.js.map