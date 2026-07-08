import { boolean, index, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

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
