import type { Database } from '../db/index.js'

/**
 * Hono custom environment type.
 * Used as the generic parameter for Hono instances: `new Hono<AppEnv>()`
 */
export interface AppEnv {
  Variables: {
    db: Database
    accountId?: string
    tenantId?: string
  }
}
