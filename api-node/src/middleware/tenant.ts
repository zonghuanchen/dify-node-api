import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types/hono-env.js'

/**
 * Tenant resolution middleware stub.
 * Implementation pending.
 *
 * Will resolve the current tenant (workspace) from:
 * - Authenticated user's current_tenant
 * - X-Tenant-Id header
 * - URL path parameters
 */
export const resolveTenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  // TODO: Implement tenant resolution
  // - Read accountId from context (set by auth middleware)
  // - Load tenant_account_joins to find current tenant
  // - Set c.set('tenantId', ...)
  await next()
}
