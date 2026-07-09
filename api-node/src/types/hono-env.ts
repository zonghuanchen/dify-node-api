import type { Database } from '../db/index.js'
import type { apps } from '../db/schema.js'

/**
 * Hono custom environment type.
 * Used as the generic parameter for Hono instances: `new Hono<AppEnv>()`
 */
export interface AppEnv {
  Variables: {
    db: Database
    accountId?: string
    tenantId?: string
    tenantRole?: string
    /** App resolved from Service API token (set by requireApiToken middleware). */
    serviceApiApp?: typeof apps.$inferSelect
  }
}
