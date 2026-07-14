import { boolean, doublePrecision, index, integer, json, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

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
  useIconAsAnswerIcon: boolean('use_icon_as_answer_icon').notNull().default(false),
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

// ── dify_setups ──
// Mirrors Python model: api/models/model.py DifySetup class
export const difySetups = pgTable('dify_setups', {
  version: varchar('version', { length: 255 }).primaryKey(),
  setupAt: timestamp('setup_at').notNull().defaultNow(),
})

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

// ── installed_apps ──
// Mirrors Python model: api/models/model.py InstalledApp class
export const installedApps = pgTable('installed_apps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  appOwnerTenantId: varchar('app_owner_tenant_id', { length: 36 }).notNull(),
  position: integer('position').notNull().default(0),
  isPinned: boolean('is_pinned').notNull().default(false),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('installed_app_tenant_id_idx').on(t.tenantId),
  index('installed_app_app_id_idx').on(t.appId),
  unique('unique_tenant_app').on(t.tenantId, t.appId),
])

// ── recommended_apps ──
// Mirrors Python model: api/models/model.py RecommendedApp class
export const recommendedApps = pgTable('recommended_apps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  description: json('description').notNull(),
  copyright: varchar('copyright', { length: 255 }).notNull(),
  privacyPolicy: varchar('privacy_policy', { length: 255 }).notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  categories: json('categories'),
  customDisclaimer: text('custom_disclaimer').default(''),
  position: integer('position').notNull().default(0),
  isListed: boolean('is_listed').notNull().default(true),
  isLearnDify: boolean('is_learn_dify').notNull().default(false),
  isCloudOnly: boolean('is_cloud_only').notNull().default(false),
  installCount: integer('install_count').notNull().default(0),
  language: varchar('language', { length: 255 }).notNull().default('en-US'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('recommended_app_app_id_idx').on(t.appId),
  index('recommended_app_is_listed_idx').on(t.isListed, t.language),
])

// ── app_model_configs ──
// Mirrors Python model: api/models/model.py AppModelConfig class
// Only fields needed for installed-apps filtering are included.
export const appModelConfigs = pgTable('app_model_configs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('app_app_id_idx').on(t.appId),
])

// ── workflows ──
// Mirrors Python model: api/models/workflow.py Workflow class
export const workflows = pgTable('workflows', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  type: varchar('type', { length: 255 }),
  kind: varchar('kind', { length: 255 }),
  version: varchar('version', { length: 255 }),
  markedName: varchar('marked_name', { length: 255 }).default(''),
  markedComment: varchar('marked_comment', { length: 255 }).default(''),
  graph: text('graph'),
  features: text('features'),
  createdBy: varchar('created_by', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedBy: varchar('updated_by', { length: 36 }),
  updatedAt: timestamp('updated_at'),
  environmentVariables: text('environment_variables').default('{}'),
  conversationVariables: text('conversation_variables').default('{}'),
  ragPipelineVariables: text('rag_pipeline_variables').default('{}'),
}, (t) => [
  index('workflow_version_idx').on(t.tenantId, t.appId, t.version),
])

// ── app_stars ──
// Mirrors Python model: api/models/model.py AppStar class
export const appStars = pgTable('app_stars', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  accountId: varchar('account_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('app_star_tenant_id_idx').on(t.tenantId),
  index('app_star_app_id_idx').on(t.appId),
  index('app_star_account_id_idx').on(t.accountId),
  unique('unique_app_star_tenant_account_app').on(t.tenantId, t.accountId, t.appId),
])

// ── trial_apps ──
// Mirrors Python model: api/models/model.py TrialApp class
export const trialApps = pgTable('trial_apps', {
  id: varchar('id', { length: 36 }).primaryKey(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('trial_app_app_id_idx').on(t.appId),
  index('trial_app_tenant_id_idx').on(t.tenantId),
])

// ── tags ──
// Mirrors Python model: api/models/model.py Tag class
export const tags = pgTable('tags', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }),
  type: varchar('type', { length: 16 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('tag_type_idx').on(t.type),
  index('tag_name_idx').on(t.name),
])

// ── tag_bindings ──
// Mirrors Python model: api/models/model.py TagBinding class
export const tagBindings = pgTable('tag_bindings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }),
  tagId: varchar('tag_id', { length: 36 }),
  targetId: varchar('target_id', { length: 36 }),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('tag_bind_target_id_idx').on(t.targetId),
  index('tag_bind_tag_id_idx').on(t.tagId),
])

// ── app_triggers ──
// Mirrors Python model: api/models/trigger.py AppTrigger class
export const appTriggers = pgTable('app_triggers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  nodeId: varchar('node_id', { length: 64 }),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  providerName: varchar('provider_name', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('enabled'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('app_trigger_tenant_app_idx').on(t.tenantId, t.appId),
])

// ── upload_files ──
// Mirrors Python model: api/models/model.py UploadFile class
export const uploadFiles = pgTable('upload_files', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 36 }).notNull(),
  storageType: varchar('storage_type', { length: 255 }).notNull(),
  key: varchar('key', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  size: integer('size').notNull(),
  extension: varchar('extension', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }),
  createdByRole: varchar('created_by_role', { length: 255 }).notNull().default('account'),
  createdBy: varchar('created_by', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  used: boolean('used').notNull().default(false),
  usedBy: varchar('used_by', { length: 36 }),
  usedAt: timestamp('used_at'),
  hash: varchar('hash', { length: 255 }),
  sourceUrl: text('source_url').default(''),
}, (t) => [
  index('upload_file_tenant_idx').on(t.tenantId),
])

// ── sites ──
// Mirrors Python model: api/models/model.py Site class
export const sites = pgTable('sites', {
  id: varchar('id', { length: 36 }).primaryKey(),
  appId: varchar('app_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 255 }).notNull().default(''),
  iconType: varchar('icon_type', { length: 255 }),
  icon: varchar('icon', { length: 255 }),
  iconBackground: varchar('icon_background', { length: 255 }),
  description: text('description'),
  defaultLanguage: varchar('default_language', { length: 255 }).notNull().default('en-US'),
  chatColorTheme: varchar('chat_color_theme', { length: 255 }),
  chatColorThemeInverted: boolean('chat_color_theme_inverted').notNull().default(false),
  copyright: varchar('copyright', { length: 255 }),
  privacyPolicy: varchar('privacy_policy', { length: 255 }),
  inputPlaceholder: varchar('input_placeholder', { length: 255 }),
  showWorkflowSteps: boolean('show_workflow_steps').notNull().default(true),
  useIconAsAnswerIcon: boolean('use_icon_as_answer_icon').notNull().default(false),
  customDisclaimer: text('custom_disclaimer').default(''),
  customizeDomain: varchar('customize_domain', { length: 255 }),
  customizeTokenStrategy: varchar('customize_token_strategy', { length: 255 }).notNull().default('must-use'),
  promptPublic: boolean('prompt_public').notNull().default(false),
  status: varchar('status', { length: 255 }).notNull().default('normal'),
  code: varchar('code', { length: 255 }),
  createdBy: varchar('created_by', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedBy: varchar('updated_by', { length: 36 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('site_app_id_idx').on(t.appId),
])
