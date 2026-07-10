/**
 * Feature service — mirrors Python api/services/feature_service.py.
 *
 * Provides system-wide feature flags and configuration used by the console
 * dashboard and web app for UI initialization.
 */

import { config } from '../config/index.js'

// ── Response model types (mirror Python Pydantic models) ──────────

export interface LicenseLimitationModel {
  enabled: boolean
  size: number
  limit: number
}

export type LicenseStatus = 'none' | 'inactive' | 'active' | 'expiring' | 'expired' | 'lost'

export interface LicenseModel {
  status: LicenseStatus
  expired_at: string
  workspaces: LicenseLimitationModel
}

export interface BrandingModel {
  enabled: boolean
  application_title: string
  login_page_logo: string
  workspace_logo: string
  favicon: string
}

export interface WebAppAuthSSOModel {
  protocol: string
}

export interface WebAppAuthModel {
  enabled: boolean
  allow_sso: boolean
  sso_config: WebAppAuthSSOModel
  allow_email_code_login: boolean
  allow_email_password_login: boolean
}

export type PluginInstallationScope = 'none' | 'official_only' | 'official_and_specific_partners' | 'all'

export interface PluginInstallationPermissionModel {
  plugin_installation_scope: PluginInstallationScope
  restrict_to_marketplace_only: boolean
}

export interface PluginManagerModel {
  enabled: boolean
}

// ── Tenant-level feature model (GET /features) ──────────────────

export interface SubscriptionModel {
  plan: string
  interval: string
}

export interface BillingModel {
  enabled: boolean
  subscription: SubscriptionModel
}

export interface EducationModel {
  enabled: boolean
  activated: boolean
}

export interface LimitationModel {
  size: number
  limit: number
}

export interface QuotaModel {
  usage: number
  limit: number
  reset_date: number
}

export interface KnowledgePipeline {
  publish_enabled: boolean
}

/**
 * Tenant-level feature flags — mirrors Python FeatureModel.
 * Returned by GET /console/api/features.
 */
export interface FeatureModel {
  billing: BillingModel
  education: EducationModel
  members: LimitationModel
  apps: LimitationModel
  vector_space: LimitationModel | null
  knowledge_rate_limit: number
  annotation_quota_limit: LimitationModel
  documents_upload_quota: LimitationModel
  docs_processing: string
  can_replace_logo: boolean
  model_load_balancing_enabled: boolean
  dataset_operator_enabled: boolean
  webapp_copyright_enabled: boolean
  workspace_members: LicenseLimitationModel
  is_allow_transfer_workspace: boolean
  trigger_event: QuotaModel
  api_rate_limit: QuotaModel
  human_input_email_delivery_enabled: boolean
  knowledge_pipeline: KnowledgePipeline
  next_credit_reset_date: number
}

export interface SystemFeatureModel {
  enable_app_deploy: boolean
  sso_enforced_for_signin: boolean
  sso_enforced_for_signin_protocol: string
  enable_marketplace: boolean
  max_plugin_package_size: number
  enable_email_code_login: boolean
  enable_email_password_login: boolean
  enable_social_oauth_login: boolean
  enable_collaboration_mode: boolean
  is_allow_register: boolean
  is_allow_create_workspace: boolean
  is_email_setup: boolean
  license: LicenseModel
  branding: BrandingModel
  webapp_auth: WebAppAuthModel
  plugin_installation_permission: PluginInstallationPermissionModel
  enable_change_email: boolean
  plugin_manager: PluginManagerModel
  enable_creators_platform: boolean
  enable_trial_app: boolean
  enable_explore_banner: boolean
  enable_learn_app: boolean
  rbac_enabled: boolean
}

// ── Default factories ─────────────────────────────────────────────

function defaultLicenseLimitation(): LicenseLimitationModel {
  return { enabled: false, size: 0, limit: 0 }
}

function defaultLicense(): LicenseModel {
  return {
    status: 'none',
    expired_at: '',
    workspaces: defaultLicenseLimitation(),
  }
}

function defaultBranding(): BrandingModel {
  return {
    enabled: false,
    application_title: '',
    login_page_logo: '',
    workspace_logo: '',
    favicon: '',
  }
}

function defaultWebAppAuth(): WebAppAuthModel {
  return {
    enabled: false,
    allow_sso: false,
    sso_config: { protocol: '' },
    allow_email_code_login: false,
    allow_email_password_login: false,
  }
}

function defaultPluginInstallationPermission(): PluginInstallationPermissionModel {
  return {
    plugin_installation_scope: 'all',
    restrict_to_marketplace_only: false,
  }
}

function defaultPluginManager(): PluginManagerModel {
  return { enabled: false }
}

// ── System features builder ───────────────────────────────────────

/**
 * Build system feature flags from environment config.
 * Mirrors `FeatureService.get_system_features()` in Python.
 *
 * @param isAuthenticated - whether the caller has a valid JWT session.
 *   Used by enterprise mode to gate sensitive license details.
 */
export function getSystemFeatures(isAuthenticated: boolean = false): SystemFeatureModel {
  const features: SystemFeatureModel = {
    enable_app_deploy: false,
    sso_enforced_for_signin: false,
    sso_enforced_for_signin_protocol: '',
    enable_marketplace: false,
    max_plugin_package_size: config.pluginMaxPackageSize,
    enable_email_code_login: false,
    enable_email_password_login: true,
    enable_social_oauth_login: false,
    enable_collaboration_mode: true,
    is_allow_register: false,
    is_allow_create_workspace: false,
    is_email_setup: false,
    license: defaultLicense(),
    branding: defaultBranding(),
    webapp_auth: defaultWebAppAuth(),
    plugin_installation_permission: defaultPluginInstallationPermission(),
    enable_change_email: true,
    plugin_manager: defaultPluginManager(),
    enable_creators_platform: false,
    enable_trial_app: false,
    enable_explore_banner: false,
    enable_learn_app: true,
    rbac_enabled: config.rbacEnabled,
  }

  fulfillSystemParamsFromEnv(features)

  if (config.enterpriseEnabled) {
    features.branding.enabled = true
    features.webapp_auth.enabled = true
    features.enable_change_email = false
    features.plugin_manager.enabled = true
    fulfillParamsFromEnterprise(features, isAuthenticated)
  }

  if (config.marketplaceEnabled) {
    features.enable_marketplace = true
  }

  if (config.creatorsPlatformFeaturesEnabled) {
    features.enable_creators_platform = true
  }

  return features
}

// ── Tenant-level features builder ───────────────────────────────

/**
 * Build tenant-level feature flags from environment config.
 * Mirrors `FeatureService.get_features()` in Python.
 *
 * For self-hosted deployments (BILLING_ENABLED=false, ENTERPRISE_ENABLED=false),
 * most billing/enterprise fields return defaults.
 */
export function getFeatures(_tenantId: string): FeatureModel {
  const features: FeatureModel = {
    billing: { enabled: false, subscription: { plan: 'sandbox', interval: '' } },
    education: { enabled: config.educationEnabled, activated: false },
    members: { size: 0, limit: 1 },
    apps: { size: 0, limit: 10 },
    vector_space: null, // excluded per Python's exclude_vector_space=True convention
    knowledge_rate_limit: 10,
    annotation_quota_limit: { size: 0, limit: 10 },
    documents_upload_quota: { size: 0, limit: 50 },
    docs_processing: 'standard',
    can_replace_logo: config.canReplaceLogo,
    model_load_balancing_enabled: config.modelLbEnabled,
    dataset_operator_enabled: config.datasetOperatorEnabled,
    webapp_copyright_enabled: false,
    workspace_members: { enabled: false, size: 0, limit: 0 },
    is_allow_transfer_workspace: true,
    trigger_event: { usage: 0, limit: 3000, reset_date: 0 },
    api_rate_limit: { usage: 0, limit: 5000, reset_date: 0 },
    human_input_email_delivery_enabled: !config.billingEnabled, // true when not SaaS
    knowledge_pipeline: { publish_enabled: config.enterpriseEnabled },
    next_credit_reset_date: 0,
  }

  return features
}

// ── Internal helpers ──────────────────────────────────────────────

function fulfillSystemParamsFromEnv(features: SystemFeatureModel): void {
  features.enable_email_code_login = config.enableEmailCodeLogin
  features.enable_email_password_login = config.enableEmailPasswordLogin
  features.enable_social_oauth_login = config.enableSocialOauthLogin
  features.enable_collaboration_mode = config.enableCollaborationMode
  features.is_allow_register = config.allowRegister
  features.is_allow_create_workspace = config.allowCreateWorkspace
  features.is_email_setup = config.mailType !== ''
  features.enable_trial_app = config.enableTrialApp
  features.enable_explore_banner = config.enableExploreBanner
  features.enable_learn_app = config.enableLearnApp
}

/**
 * Enterprise overrides — placeholder until EnterpriseService is implemented
 * in api-node. When ENTERPRISE_ENABLED=true, callers should integrate with
 * the enterprise API to populate branding, SSO, license, and webapp auth fields.
 *
 * TODO: Implement EnterpriseService.get_info() and wire it here.
 * See Python: api/services/feature_service.py `_fulfill_params_from_enterprise`.
 */
function fulfillParamsFromEnterprise(_features: SystemFeatureModel, _isAuthenticated: boolean): void {
  // Enterprise integration not yet implemented in api-node.
  // When implemented, this function should call EnterpriseService.get_info()
  // and override the relevant fields on `features`.
}
