/**
 * Plugin basic routes — daemon proxy endpoints.
 *
 * Mirrors Python `api/controllers/console/workspace/plugin.py`:
 * - GET  /workspaces/current/plugin/debugging-key          (L489-506)
 * - POST /workspaces/current/plugin/list/latest-versions   (L563-578)
 * - POST /workspaces/current/plugin/list/installations/ids (L581-597)
 * - GET  /workspaces/current/plugin/fetch-manifest         (L791-809)
 * - GET  /workspaces/current/plugin/icon                   (L600-614)
 * - GET  /workspaces/current/plugin/asset                  (L617-632)
 * - GET  /workspaces/current/plugin/readme                 (L1147-1159)
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { requirePluginDebugPermission, requirePluginInstallPermission } from '../../../middleware/plugin-permission.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import {
  extractAsset,
  fetchPluginManifest,
  fetchPluginReadme,
  getAsset,
  getDebuggingKey,
  listInstallationsFromIds,
  listLatestVersions,
} from '../../../services/plugin-basic.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const pluginBasicRoute = new Hono<AppEnv>()

// ── Shared middleware (auth + account init + tenant) ──────────────────────────

const baseMw = [requireAuth, requireAccountInitialized, resolveTenant] as const

// ── GET /workspaces/current/plugin/debugging-key ──────────────────────────────
// Mirrors plugin.py L489-506.
// Python decorators: setup_required, login_required, account_initialization_required,
//   rbac_permission_required(PLUGIN_DEBUG), plugin_permission_required(debug_required=True)

pluginBasicRoute.get(
  '/workspaces/current/plugin/debugging-key',
  ...baseMw,
  requirePluginDebugPermission,
  async (c) => {
    const tenantId = c.get('tenantId')!
    try {
      const result = await getDebuggingKey(tenantId)
      return c.json(result)
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)

// ── POST /workspaces/current/plugin/list/latest-versions ──────────────────────
// Mirrors plugin.py L563-578.
// Python decorators: setup_required, login_required, account_initialization_required

pluginBasicRoute.post(
  '/workspaces/current/plugin/list/latest-versions',
  ...baseMw,
  async (c) => {
    const body = await c.req.json<{ plugin_ids: string[] }>()
    const pluginIds = body.plugin_ids ?? []

    try {
      const versions = await listLatestVersions(pluginIds)
      return c.json({ versions })
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)

// ── POST /workspaces/current/plugin/list/installations/ids ────────────────────
// Mirrors plugin.py L581-597.
// Python decorators: setup_required, login_required, account_initialization_required

pluginBasicRoute.post(
  '/workspaces/current/plugin/list/installations/ids',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{ plugin_ids: string[] }>()
    const pluginIds = body.plugin_ids ?? []

    try {
      const plugins = await listInstallationsFromIds(tenantId, pluginIds)
      return c.json({ plugins })
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)

// ── GET /workspaces/current/plugin/fetch-manifest ─────────────────────────────
// Mirrors plugin.py L791-809.
// Python decorators: setup_required, login_required, account_initialization_required,
//   rbac_permission_required(PLUGIN_INSTALL), plugin_permission_required(install_required=True)

pluginBasicRoute.get(
  '/workspaces/current/plugin/fetch-manifest',
  ...baseMw,
  requirePluginInstallPermission,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const pluginUniqueIdentifier = c.req.query('plugin_unique_identifier')
    if (!pluginUniqueIdentifier) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifier is required' }, 400)
    }

    try {
      const manifest = await fetchPluginManifest(tenantId, pluginUniqueIdentifier)
      return c.json({ manifest })
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)

// ── GET /workspaces/current/plugin/icon ───────────────────────────────────────
// Mirrors plugin.py L600-614.
// Python decorators: setup_required (no login_required — icons are public)

pluginBasicRoute.get(
  '/workspaces/current/plugin/icon',
  async (c) => {
    const tenantId = c.req.query('tenant_id')
    const filename = c.req.query('filename')
    if (!tenantId || !filename) {
      return c.json({ code: 'invalid_param', message: 'tenant_id and filename are required' }, 400)
    }

    try {
      const { data, mimeType } = await getAsset(tenantId, filename)
      return c.body(data, 200, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
      })
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)

// ── GET /workspaces/current/plugin/asset ──────────────────────────────────────
// Mirrors plugin.py L617-632.
// Python decorators: setup_required, login_required, account_initialization_required

pluginBasicRoute.get(
  '/workspaces/current/plugin/asset',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const pluginUniqueIdentifier = c.req.query('plugin_unique_identifier')
    const fileName = c.req.query('file_name')
    if (!pluginUniqueIdentifier || !fileName) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifier and file_name are required' }, 400)
    }

    try {
      const data = await extractAsset(tenantId, pluginUniqueIdentifier, fileName)
      return c.body(data, 200, {
        'Content-Type': 'application/octet-stream',
      })
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)

// ── GET /workspaces/current/plugin/readme ─────────────────────────────────────
// Mirrors plugin.py L1147-1159.
// Python decorators: setup_required, login_required, account_initialization_required

pluginBasicRoute.get(
  '/workspaces/current/plugin/readme',
  ...baseMw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const pluginUniqueIdentifier = c.req.query('plugin_unique_identifier')
    const language = c.req.query('language') || 'en-US'
    if (!pluginUniqueIdentifier) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifier is required' }, 400)
    }

    try {
      const readme = await fetchPluginReadme(tenantId, pluginUniqueIdentifier, language)
      return c.json({ readme })
    }
    catch (err) {
      if (err instanceof Error && err.message.includes('plugin_error')) {
        return c.json({ code: 'plugin_error', message: err.message }, 400)
      }
      throw err
    }
  },
)
