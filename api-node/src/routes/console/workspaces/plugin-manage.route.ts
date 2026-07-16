/**
 * Plugin management routes — permission, auto-upgrade, and listing.
 *
 * Mirrors Python `api/controllers/console/workspace/plugin.py`:
 * - GET  /workspaces/current/plugin/list                  (L509-525)
 * - GET  /workspaces/current/plugin/:category/list        (L528-560)
 * - GET  /workspaces/current/plugin/permission/fetch      (L984-1006)
 * - POST /workspaces/current/plugin/permission/change     (L960-981)
 * - POST /workspaces/current/plugin/auto-upgrade/change   (L1072-1101)
 * - GET  /workspaces/current/plugin/auto-upgrade/fetch    (L1104-1126)
 * - POST /workspaces/current/plugin/auto-upgrade/exclude  (L1129-1144)
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { requirePluginInstallPermission } from '../../../middleware/plugin-permission.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import {
  changeAutoUpgradeStrategy,
  changePluginPermission,
  excludePluginFromAutoUpgrade,
  getAutoUpgradeStrategy,
  getPluginPermission,
  isAdminOrOwner,
  isValidCategory,
  isValidStrategySetting,
  isValidUpgradeMode,
  listPlugins,
  listPluginsByCategory,
} from '../../../services/plugin-manage.service.js'
import type { AppEnv } from '../../../types/hono-env.js'
import type { PluginCategory } from '../../../services/plugin-manage.service.js'

export const pluginManageRoute = new Hono<AppEnv>()

/** Shared middleware chain. */
const baseMw = [requireAuth, requireAccountInitialized, resolveTenant] as const

// ── GET /workspaces/current/plugin/list ───────────────────────────────────────
// Mirrors plugin.py L509-525.

pluginManageRoute.get(
  '/workspaces/current/plugin/list',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const accountId = c.get('accountId')!
    const page = Math.max(1, Number(c.req.query('page') || '1'))
    const pageSize = Math.max(1, Math.min(256, Number(c.req.query('page_size') || '256')))

    try {
      const result = await listPlugins(tenantId, accountId, page, pageSize)
      return c.json({ plugins: result.plugins, total: result.total })
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── GET /workspaces/current/plugin/:category/list ─────────────────────────────
// Mirrors plugin.py L528-560.
// Note: builtin_tools are omitted for the category=tool response (complex Python dependency).

pluginManageRoute.get(
  '/workspaces/current/plugin/:category/list',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const category = c.req.param('category')

    if (!isValidCategory(category)) {
      return c.json({ code: 'invalid_param', message: 'invalid plugin category' }, 400)
    }

    const page = Math.max(1, Number(c.req.query('page') || '1'))
    const pageSize = Math.max(1, Math.min(256, Number(c.req.query('page_size') || '256')))

    try {
      const result = await listPluginsByCategory(tenantId, category as PluginCategory, page, pageSize)
      return c.json({
        plugins: result.plugins,
        builtin_tools: [], // Simplified: builtin tool providers require Python ToolManager
        has_more: result.has_more,
      })
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── GET /workspaces/current/plugin/permission/fetch ───────────────────────────
// Mirrors plugin.py L984-1006.

pluginManageRoute.get(
  '/workspaces/current/plugin/permission/fetch',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    const permission = await getPluginPermission(db, tenantId)
    return c.json(permission)
  },
)

// ── POST /workspaces/current/plugin/permission/change ─────────────────────────
// Mirrors plugin.py L960-981.
// Python: with_current_user + admin_or_owner check.

pluginManageRoute.post(
  '/workspaces/current/plugin/permission/change',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const tenantRole = c.get('tenantRole')

    if (!isAdminOrOwner(tenantRole)) {
      return c.json({ code: 'forbidden', message: 'Forbidden.' }, 403)
    }

    const body = await c.req.json<{
      install_permission?: string
      debug_permission?: string
    }>()

    const installPermission = body.install_permission || 'everyone'
    const debugPermission = body.debug_permission || 'everyone'

    const db = c.get('db')
    const success = await changePluginPermission(db, tenantId, installPermission, debugPermission)
    return c.json({ success })
  },
)

// ── POST /workspaces/current/plugin/auto-upgrade/change ───────────────────────
// Mirrors plugin.py L1072-1101.

pluginManageRoute.post(
  '/workspaces/current/plugin/auto-upgrade/change',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const tenantRole = c.get('tenantRole')

    // When RBAC is disabled, check admin/owner role
    if (!isAdminOrOwner(tenantRole)) {
      return c.json({ code: 'forbidden', message: 'Forbidden.' }, 403)
    }

    const body = await c.req.json<{
      category: string
      auto_upgrade: {
        strategy_setting: string
        upgrade_time_of_day: number
        upgrade_mode: string
        exclude_plugins: string[]
        include_plugins: string[]
      }
    }>()

    if (!isValidCategory(body.category)) {
      return c.json({ code: 'invalid_param', message: 'invalid category' }, 400)
    }

    const au = body.auto_upgrade
    if (!isValidStrategySetting(au.strategy_setting)) {
      return c.json({ code: 'invalid_param', message: 'invalid strategy_setting' }, 400)
    }
    if (!isValidUpgradeMode(au.upgrade_mode)) {
      return c.json({ code: 'invalid_param', message: 'invalid upgrade_mode' }, 400)
    }

    const db = c.get('db')
    const success = await changeAutoUpgradeStrategy(
      db,
      tenantId,
      body.category as PluginCategory,
      au.strategy_setting as 'disabled' | 'fix_only' | 'latest',
      au.upgrade_time_of_day ?? 0,
      au.upgrade_mode as 'all' | 'partial' | 'exclude',
      au.exclude_plugins ?? [],
      au.include_plugins ?? [],
    )
    return c.json({ success })
  },
)

// ── GET /workspaces/current/plugin/auto-upgrade/fetch ─────────────────────────
// Mirrors plugin.py L1104-1126.

pluginManageRoute.get(
  '/workspaces/current/plugin/auto-upgrade/fetch',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const category = c.req.query('category')

    if (!category || !isValidCategory(category)) {
      return c.json({ code: 'invalid_param', message: 'valid category is required' }, 400)
    }

    const db = c.get('db')
    const result = await getAutoUpgradeStrategy(db, tenantId, category as PluginCategory)
    return c.json(result)
  },
)

// ── POST /workspaces/current/plugin/auto-upgrade/exclude ──────────────────────
// Mirrors plugin.py L1129-1144.

pluginManageRoute.post(
  '/workspaces/current/plugin/auto-upgrade/exclude',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!

    const body = await c.req.json<{
      plugin_id: string
      category: string
    }>()

    if (!body.plugin_id || !isValidCategory(body.category)) {
      return c.json({ code: 'invalid_param', message: 'plugin_id and valid category are required' }, 400)
    }

    const db = c.get('db')
    const success = await excludePluginFromAutoUpgrade(
      db,
      tenantId,
      body.plugin_id,
      body.category as PluginCategory,
    )
    return c.json({ success })
  },
)

// ── Error helper ──────────────────────────────────────────────────────────────

function handlePluginError(c: { json: (data: unknown, status: number) => Response }, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('plugin_error') || message.includes('plugin daemon')) {
    return c.json({ code: 'plugin_error', message }, 400)
  }
  throw err
}
