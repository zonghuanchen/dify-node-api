/**
 * Legacy RBAC permission keys.
 *
 * Mirrors Python: api/services/enterprise/rbac_service.py L305–L527
 * Used when RBAC_ENABLED=false (default). Maps each TenantAccountRole
 * to its workspace / app / dataset permission key lists.
 */

// ── Workspace permission keys ─────────────────────────────────────────────────

const LEGACY_WORKSPACE_OWNER_KEYS = [
  'workspace.member.manage',
  'workspace.role.manage',
  'data_source.manage',
  'api_extension.manage',
  'customization.manage',
  'plugin.install',
  'plugin.plugin_preferences',
  'plugin.model_config',
  'plugin.delete',
  'plugin.debug',
  'credential.use',
  'credential.create',
  'credential.manage',
  'billing.view',
  'billing.subscription.manage',
  'billing.manage',
  'app.acl.preview',
  'app_library.access',
  'app.create_and_management',
  'app.tag.manage',
  'dataset.acl.preview',
  'dataset.create_and_management',
  'dataset.tag.manage',
  'dataset.external.connect',
  'dataset.api_key.manage',
  'snippets.create_and_modify',
  'snippets.management',
  'tool.manage',
  'mcp.manage',
] as const

const LEGACY_WORKSPACE_ADMIN_KEYS = [
  'workspace.member.manage',
  'workspace.role.manage',
  'data_source.manage',
  'api_extension.manage',
  'customization.manage',
  'plugin.install',
  'plugin.plugin_preferences',
  'plugin.model_config',
  'plugin.delete',
  'plugin.debug',
  'credential.use',
  'credential.create',
  'credential.manage',
  'billing.view',
  'billing.subscription.manage',
  'billing.manage',
  'app_library.access',
  'app.create_and_management',
  'app.tag.manage',
  'dataset.create_and_management',
  'dataset.tag.manage',
  'dataset.external.connect',
  'dataset.api_key.manage',
  'snippets.create_and_modify',
  'snippets.management',
  'tool.manage',
  'mcp.manage',
] as const

const LEGACY_WORKSPACE_EDITOR_KEYS = [
  'api_extension.manage',
  'plugin.install',
  'credential.use',
  'app_library.access',
  'app.create_and_management',
  'app.tag.manage',
  'dataset.create_and_management',
  'dataset.tag.manage',
  'dataset.external.connect',
  'snippets.create_and_modify',
  'tool.manage',
  'billing.view',
  'billing.subscription.manage',
  'billing.manage',
] as const

const LEGACY_WORKSPACE_NORMAL_KEYS = [
  'api_extension.manage',
  'plugin.install',
  'credential.use',
  'app_library.access',
  'billing.view',
  'billing.subscription.manage',
  'billing.manage',
] as const

const LEGACY_WORKSPACE_DATASET_OPERATOR_KEYS = [
  'plugin.install',
  'dataset.create_and_management',
  'dataset.external.connect',
] as const

// ── App permission keys ───────────────────────────────────────────────────────

const LEGACY_APP_OWNER_KEYS = [
  'app.acl.preview',
  'app.acl.view_layout',
  'app.acl.test_and_run',
  'app.acl.edit',
  'app.acl.import_export_dsl',
  'app.acl.delete',
  'app.acl.release_and_version',
  'app.acl.monitor',
  'app.acl.access_config',
  'app.acl.tracing_config',
  'app.acl.log_and_annotation',
] as const

const LEGACY_APP_ADMIN_KEYS = [
  'app.acl.preview',
  'app.acl.view_layout',
  'app.acl.test_and_run',
  'app.acl.edit',
  'app.acl.import_export_dsl',
  'app.acl.delete',
  'app.acl.release_and_version',
  'app.acl.monitor',
  'app.acl.access_config',
  'app.acl.access_config', // intentional duplicate — mirrors Python source
  'app.acl.tracing_config',
  'app.acl.log_and_annotation',
] as const

const LEGACY_APP_EDITOR_KEYS = [
  'app.acl.preview',
  'app.acl.view_layout',
  'app.acl.test_and_run',
  'app.acl.edit',
  'app.acl.import_export_dsl',
  'app.acl.delete',
  'app.acl.release_and_version',
  'app.acl.monitor',
  'app.acl.log_and_annotation',
  'app.acl.access_config',
] as const

const LEGACY_APP_NORMAL_KEYS = [
  'app.acl.monitor',
] as const

// ── Dataset permission keys ───────────────────────────────────────────────────

const LEGACY_DATASET_OWNER_KEYS = [
  'dataset.acl.preview',
  'dataset.acl.readonly',
  'dataset.acl.edit',
  'dataset.acl.import_export_dsl',
  'dataset.acl.pipeline_test',
  'dataset.acl.document_download',
  'dataset.acl.retrieval_recall',
  'dataset.acl.use',
  'dataset.acl.delete_file',
  'dataset.acl.pipeline_release',
  'dataset.acl.delete',
  'dataset.acl.access_config',
  'dataset.api_key.manage',
] as const

const LEGACY_DATASET_ADMIN_KEYS = [
  'dataset.acl.preview',
  'dataset.acl.readonly',
  'dataset.acl.edit',
  'dataset.acl.import_export_dsl',
  'dataset.acl.pipeline_test',
  'dataset.acl.document_download',
  'dataset.acl.retrieval_recall',
  'dataset.acl.use',
  'dataset.acl.delete_file',
  'dataset.acl.pipeline_release',
  'dataset.acl.delete',
  'dataset.acl.access_config',
  'dataset.api_key.manage',
] as const

const LEGACY_DATASET_EDITOR_KEYS = [
  'dataset.acl.preview',
  'dataset.acl.readonly',
  'dataset.acl.edit',
  'dataset.acl.import_export_dsl',
  'dataset.acl.pipeline_test',
  'dataset.acl.document_download',
  'dataset.acl.retrieval_recall',
  'dataset.acl.use',
  'dataset.acl.delete_file',
  'dataset.acl.pipeline_release',
] as const

const LEGACY_DATASET_DATASET_OPERATOR_KEYS = [
  'dataset.acl.readonly',
  'dataset.acl.edit',
  'dataset.acl.import_export_dsl',
  'dataset.acl.pipeline_test',
  'dataset.acl.document_download',
  'dataset.acl.retrieval_recall',
  'dataset.acl.use',
  'dataset.acl.delete_file',
  'dataset.acl.pipeline_release',
] as const

// ── Combined mapping: role → { workspace, app?, dataset? } ────────────────────

export interface LegacyRolePermissions {
  workspace: readonly string[]
  app?: readonly string[]
  dataset?: readonly string[]
}

export const LEGACY_MY_PERMISSIONS: Record<string, LegacyRolePermissions> = {
  owner: {
    workspace: LEGACY_WORKSPACE_OWNER_KEYS,
    app: LEGACY_APP_OWNER_KEYS,
    dataset: LEGACY_DATASET_OWNER_KEYS,
  },
  admin: {
    workspace: LEGACY_WORKSPACE_ADMIN_KEYS,
    app: LEGACY_APP_ADMIN_KEYS,
    dataset: LEGACY_DATASET_ADMIN_KEYS,
  },
  editor: {
    workspace: LEGACY_WORKSPACE_EDITOR_KEYS,
    app: LEGACY_APP_EDITOR_KEYS,
    dataset: LEGACY_DATASET_EDITOR_KEYS,
  },
  normal: {
    workspace: LEGACY_WORKSPACE_NORMAL_KEYS,
    app: LEGACY_APP_NORMAL_KEYS,
    // no dataset keys
  },
  dataset_operator: {
    workspace: LEGACY_WORKSPACE_DATASET_OPERATOR_KEYS,
    // no app keys
    dataset: LEGACY_DATASET_DATASET_OPERATOR_KEYS,
  },
}

/** Valid TenantAccountRole values (mirrors Python TenantAccountRole enum). */
export const VALID_TENANT_ROLES = new Set(['owner', 'admin', 'editor', 'normal', 'dataset_operator'])
