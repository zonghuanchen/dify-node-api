/**
 * Plugin permission middleware.
 *
 * Mirrors Python `api/controllers/console/workspace/__init__.py`
 * `plugin_permission_required(install_required=True)`.
 *
 * When RBAC is enabled, permission checks are delegated to the RBAC system
 * and this middleware is a no-op.
 *
 * When RBAC is disabled:
 * 1. Look up `account_plugin_permissions` for the current tenant.
 * 2. If no record exists → allow (everyone has access).
 * 3. Check the relevant permission field against the user's role.
 */

import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { config } from '../config/index.js'
import { accountPluginPermissions } from '../db/schema.js'
import type { AppEnv } from '../types/hono-env.js'

const ADMIN_ROLES = new Set(['owner', 'admin'])

type PermissionField = 'installPermission' | 'debugPermission'

/**
 * Create a middleware that checks plugin install/debug permissions.
 *
 * @param field - Which permission field to check: 'installPermission' or 'debugPermission'
 */
export function requirePluginPermission(field: PermissionField): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // When RBAC is enabled, permission is handled by rbac_permission_required.
    if (config.rbacEnabled) {
      return next()
    }

    const tenantId = c.get('tenantId')
    const tenantRole = c.get('tenantRole')
    if (!tenantId) {
      return c.json({ code: 'unauthorized', message: 'Unauthorized.' }, 401)
    }

    const db = c.get('db')

    const [permission] = await db
      .select({ [field]: accountPluginPermissions[field] })
      .from(accountPluginPermissions)
      .where(eq(accountPluginPermissions.tenantId, tenantId))
      .limit(1)

    // No permission record → allow access for everyone (mirrors Python).
    if (!permission) {
      return next()
    }

    const value = permission[field]

    switch (value) {
      case 'noone':
        // NOBODY is allowed.
        return c.json({ code: 'forbidden', message: 'Forbidden.' }, 403)
      case 'admins':
        if (!tenantRole || !ADMIN_ROLES.has(tenantRole)) {
          return c.json({ code: 'forbidden', message: 'Forbidden.' }, 403)
        }
        return next()
      case 'everyone':
      default:
        return next()
    }
  }
}

/** Convenience: require plugin install permission. */
export const requirePluginInstallPermission = requirePluginPermission('installPermission')

/** Convenience: require plugin debug permission. */
export const requirePluginDebugPermission = requirePluginPermission('debugPermission')
