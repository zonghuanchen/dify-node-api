import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

// ── accounts ──
// Mirrors Python model: api/models/account.py Account class
// Note: Python StringUUID maps to varchar, NOT PostgreSQL native uuid type
export const accounts = pgTable('accounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }),
  passwordSalt: varchar('password_salt', { length: 255 }),
  avatar: varchar('avatar', { length: 255 }),
  interfaceLanguage: varchar('interface_language', { length: 255 }),
  interfaceTheme: varchar('interface_theme', { length: 255 }),
  timezone: varchar('timezone', { length: 255 }),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 255 }),
  lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  initializedAt: timestamp('initialized_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('account_email_idx').on(t.email),
])

// ── tenants ──
// Mirrors Python model: api/models/account.py Tenant class
export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  encryptPublicKey: text('encrypt_public_key'),
  plan: varchar('plan', { length: 255 }).notNull().default('basic'),
  status: varchar('status', { length: 255 }).notNull().default('normal'),
  customConfig: text('custom_config'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ── tenant_account_joins ──
// Mirrors Python model: api/models/account.py TenantAccountJoin class
export const tenantAccountJoins = pgTable('tenant_account_joins', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  accountId: varchar('account_id', { length: 36 }).notNull(),
  current: boolean('current').notNull().default(false),
  role: varchar('role', { length: 16 }).notNull().default('normal'),
  invitedBy: varchar('invited_by', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastOpenedAt: timestamp('last_opened_at'),
}, (t) => [
  index('tenant_account_join_account_id_idx').on(t.accountId),
  index('tenant_account_join_tenant_id_idx').on(t.tenantId),
  unique('unique_tenant_account_join').on(t.tenantId, t.accountId),
])

// ── apps ──
// Mirrors Python model: api/models/model.py App class
export const apps = pgTable('apps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  mode: varchar('mode', { length: 255 }).notNull(),
  iconType: varchar('icon_type', { length: 255 }),
  icon: varchar('icon', { length: 255 }),
  iconBackground: varchar('icon_background', { length: 255 }),
  appModelConfigId: varchar('app_model_config_id', { length: 36 }),
  workflowId: varchar('workflow_id', { length: 36 }),
  status: varchar('status', { length: 255 }).notNull().default('normal'),
  enableSite: boolean('enable_site').notNull(),
  enableApi: boolean('enable_api').notNull(),
  apiRpm: integer('api_rpm').notNull().default(0),
  apiRph: integer('api_rph').notNull().default(0),
  isDemo: boolean('is_demo').notNull().default(false),
  isPublic: boolean('is_public').notNull().default(false),
  isUniversal: boolean('is_universal').notNull().default(false),
  tracing: text('tracing'),
  maxActiveRequests: integer('max_active_requests'),
  createdBy: varchar('created_by', { length: 36 }),
  maintainer: varchar('maintainer', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedBy: varchar('updated_by', { length: 36 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('app_tenant_id_idx').on(t.tenantId),
])

// ── workflow_runs ──
// Mirrors Python model: api/models/workflow.py WorkflowRun class
export const workflowRuns = pgTable('workflow_runs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  workflowId: varchar('workflow_id', { length: 36 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  triggeredFrom: varchar('triggered_from', { length: 255 }).notNull(),
  version: varchar('version', { length: 255 }).notNull(),
  graph: text('graph'),
  inputs: text('inputs'),
  status: varchar('status', { length: 255 }).notNull(),
  outputs: text('outputs').default('{}'),
  error: text('error'),
  elapsedTime: doublePrecision('elapsed_time').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalSteps: integer('total_steps').default(0),
  createdByRole: varchar('created_by_role', { length: 255 }).notNull(),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
  exceptionsCount: integer('exceptions_count').default(0),
}, (t) => [
  index('workflow_run_triggerd_from_idx').on(t.tenantId, t.appId, t.triggeredFrom),
  index('workflow_run_created_at_id_idx').on(t.createdAt, t.id),
])

// ── api_tokens ──
// Mirrors Python model: api/models/model.py ApiToken class
export const apiTokens = pgTable('api_tokens', {
  id: varchar('id', { length: 36 }).primaryKey(),
  appId: varchar('app_id', { length: 36 }),
  tenantId: varchar('tenant_id', { length: 36 }),
  type: varchar('type', { length: 16 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('api_token_app_id_type_idx').on(t.appId, t.type),
  index('api_token_token_idx').on(t.token, t.type),
  index('api_token_tenant_idx').on(t.tenantId, t.type),
])

// ── end_users ──
// Mirrors Python model: api/models/model.py EndUser class
export const endUsers = pgTable('end_users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  appId: varchar('app_id', { length: 36 }),
  type: varchar('type', { length: 255 }).notNull(),
  externalUserId: varchar('external_user_id', { length: 255 }),
  name: varchar('name', { length: 255 }),
  isAnonymous: boolean('is_anonymous').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('end_user_session_id_idx').on(t.tenantId, t.type),
])
