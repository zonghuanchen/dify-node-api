import { z } from 'zod'

/**
 * Helper to parse boolean env vars ("true" / "false" strings).
 * Zod's z.coerce.boolean() treats any non-empty string as true, so we need this.
 */
function boolEnv(defaultValue: boolean) {
  return z
    .string()
    .default(String(defaultValue))
    .transform((v) => v === 'true')
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(5001),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/dify'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  CORS_ORIGINS: z.string().default('*'),
  SECRET_KEY: z.string().default('change-me-in-production'),
  APP_VERSION: z.string().default('1.0.0'),
  COOKIE_DOMAIN: z.string().default(''),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(60),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().default(30),
  CONSOLE_WEB_URL: z.string().default('http://localhost:3000'),
  CONSOLE_API_URL: z.string().default('http://localhost:5001'),

  // ── Feature flags (mirror Python api/configs) ─────────────────
  ENABLE_EMAIL_CODE_LOGIN: boolEnv(false),
  ENABLE_EMAIL_PASSWORD_LOGIN: boolEnv(true),
  ENABLE_SOCIAL_OAUTH_LOGIN: boolEnv(false),
  ENABLE_COLLABORATION_MODE: boolEnv(true),
  ALLOW_REGISTER: boolEnv(false),
  ALLOW_CREATE_WORKSPACE: boolEnv(false),
  MAIL_TYPE: z.string().default(''),
  ENABLE_TRIAL_APP: boolEnv(false),
  ENABLE_EXPLORE_BANNER: boolEnv(false),
  ENABLE_LEARN_APP: boolEnv(true),
  ENTERPRISE_ENABLED: boolEnv(false),
  MARKETPLACE_ENABLED: boolEnv(true),
  CREATORS_PLATFORM_FEATURES_ENABLED: boolEnv(true),
  PLUGIN_MAX_PACKAGE_SIZE: z.coerce.number().default(15_728_640),
  RBAC_ENABLED: boolEnv(false),

  // ── Vector store & tenant features ───────────────────────────
  VECTOR_STORE: z.string().default('weaviate'),
  CAN_REPLACE_LOGO: boolEnv(false),
  MODEL_LB_ENABLED: boolEnv(false),
  DATASET_OPERATOR_ENABLED: boolEnv(false),
  EDUCATION_ENABLED: boolEnv(false),
  BILLING_ENABLED: boolEnv(false),
})

function loadConfig() {
  const parsed = envSchema.parse(process.env)
  const isSecure = parsed.CONSOLE_WEB_URL.startsWith('https') && parsed.CONSOLE_API_URL.startsWith('https')
  const cookieDomain = parsed.COOKIE_DOMAIN.replace(/^\./, '') || undefined
  return {
    env: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()),
    secretKey: parsed.SECRET_KEY,
    appVersion: parsed.APP_VERSION,
    isDev: parsed.NODE_ENV === 'development',
    isProd: parsed.NODE_ENV === 'production',
    cookieDomain,
    accessTokenExpireMinutes: parsed.ACCESS_TOKEN_EXPIRE_MINUTES,
    refreshTokenExpireDays: parsed.REFRESH_TOKEN_EXPIRE_DAYS,
    consoleWebUrl: parsed.CONSOLE_WEB_URL,
    consoleApiUrl: parsed.CONSOLE_API_URL,
    isSecure,

    // Feature flags
    enableEmailCodeLogin: parsed.ENABLE_EMAIL_CODE_LOGIN,
    enableEmailPasswordLogin: parsed.ENABLE_EMAIL_PASSWORD_LOGIN,
    enableSocialOauthLogin: parsed.ENABLE_SOCIAL_OAUTH_LOGIN,
    enableCollaborationMode: parsed.ENABLE_COLLABORATION_MODE,
    allowRegister: parsed.ALLOW_REGISTER,
    allowCreateWorkspace: parsed.ALLOW_CREATE_WORKSPACE,
    mailType: parsed.MAIL_TYPE,
    enableTrialApp: parsed.ENABLE_TRIAL_APP,
    enableExploreBanner: parsed.ENABLE_EXPLORE_BANNER,
    enableLearnApp: parsed.ENABLE_LEARN_APP,
    enterpriseEnabled: parsed.ENTERPRISE_ENABLED,
    marketplaceEnabled: parsed.MARKETPLACE_ENABLED,
    creatorsPlatformFeaturesEnabled: parsed.CREATORS_PLATFORM_FEATURES_ENABLED,
    pluginMaxPackageSize: parsed.PLUGIN_MAX_PACKAGE_SIZE,
    rbacEnabled: parsed.RBAC_ENABLED,

    // Vector store & tenant features
    vectorStore: parsed.VECTOR_STORE,
    canReplaceLogo: parsed.CAN_REPLACE_LOGO,
    modelLbEnabled: parsed.MODEL_LB_ENABLED,
    datasetOperatorEnabled: parsed.DATASET_OPERATOR_ENABLED,
    educationEnabled: parsed.EDUCATION_ENABLED,
    billingEnabled: parsed.BILLING_ENABLED,
  }
}

export const config = loadConfig()
export type Config = ReturnType<typeof loadConfig>
