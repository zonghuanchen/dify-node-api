/**
 * Plugin install/uninstall/upgrade routes.
 *
 * Mirrors Python `api/controllers/console/workspace/plugin.py`:
 * - POST /workspaces/current/plugin/upload/pkg             (L635-652)
 * - POST /workspaces/current/plugin/upload/github          (L655-673)
 * - POST /workspaces/current/plugin/upload/bundle          (L676-693)
 * - POST /workspaces/current/plugin/install/pkg            (L696-714)
 * - POST /workspaces/current/plugin/install/github         (L717-741)
 * - POST /workspaces/current/plugin/install/marketplace    (L744-762)
 * - GET  /workspaces/current/plugin/marketplace/pkg        (L765-788)
 * - POST /workspaces/current/plugin/uninstall              (L941-957)
 * - POST /workspaces/current/plugin/upgrade/marketplace    (L890-910)
 * - POST /workspaces/current/plugin/upgrade/github         (L913-938)
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { requirePluginInstallPermission } from '../../../middleware/plugin-permission.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import {
  fetchMarketplacePkg,
  installFromGithub,
  installFromLocalPkg,
  installFromMarketplacePkg,
  uninstallPlugin,
  uploadBundle,
  uploadPkg,
  uploadPkgFromGithub,
  upgradePluginWithGithub,
  upgradePluginWithMarketplace,
} from '../../../services/plugin-install.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const pluginInstallRoute = new Hono<AppEnv>()

/** Shared middleware chain for install endpoints. */
const mw = [requireAuth, requireAccountInitialized, resolveTenant, requirePluginInstallPermission] as const

// ── POST /workspaces/current/plugin/upload/pkg ────────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/upload/pkg',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.parseBody()
    const file = body.pkg

    if (!(file instanceof File)) {
      return c.json({ code: 'invalid_param', message: 'pkg file is required' }, 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    try {
      const response = await uploadPkg(tenantId, arrayBuffer)
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/upload/github ─────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/upload/github',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{ repo: string; version: string; package: string }>()

    if (!body.repo || !body.version || !body.package) {
      return c.json({ code: 'invalid_param', message: 'repo, version, and package are required' }, 400)
    }

    try {
      const response = await uploadPkgFromGithub(tenantId, body.repo, body.version, body.package)
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/upload/bundle ─────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/upload/bundle',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.parseBody()
    const file = body.bundle

    if (!(file instanceof File)) {
      return c.json({ code: 'invalid_param', message: 'bundle file is required' }, 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    try {
      const response = await uploadBundle(tenantId, arrayBuffer)
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/install/pkg ───────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/install/pkg',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{ plugin_unique_identifiers: string[] }>()

    if (!body.plugin_unique_identifiers?.length) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifiers is required' }, 400)
    }

    try {
      const response = await installFromLocalPkg(tenantId, body.plugin_unique_identifiers)
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/install/github ────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/install/github',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{
      plugin_unique_identifier: string
      repo: string
      version: string
      package: string
    }>()

    if (!body.plugin_unique_identifier || !body.repo || !body.version || !body.package) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifier, repo, version, and package are required' }, 400)
    }

    try {
      const response = await installFromGithub(
        tenantId,
        body.plugin_unique_identifier,
        body.repo,
        body.version,
        body.package,
      )
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/install/marketplace ───────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/install/marketplace',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{ plugin_unique_identifiers: string[] }>()

    if (!body.plugin_unique_identifiers?.length) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifiers is required' }, 400)
    }

    try {
      const response = await installFromMarketplacePkg(tenantId, body.plugin_unique_identifiers)
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── GET /workspaces/current/plugin/marketplace/pkg ────────────────────────────

pluginInstallRoute.get(
  '/workspaces/current/plugin/marketplace/pkg',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const pluginUniqueIdentifier = c.req.query('plugin_unique_identifier')

    if (!pluginUniqueIdentifier) {
      return c.json({ code: 'invalid_param', message: 'plugin_unique_identifier is required' }, 400)
    }

    try {
      const manifest = await fetchMarketplacePkg(tenantId, pluginUniqueIdentifier)
      return c.json({ manifest })
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/uninstall ─────────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/uninstall',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{ plugin_installation_id: string }>()

    if (!body.plugin_installation_id) {
      return c.json({ code: 'invalid_param', message: 'plugin_installation_id is required' }, 400)
    }

    try {
      const db = c.get('db')
      const success = await uninstallPlugin(db, tenantId, body.plugin_installation_id)
      return c.json({ success })
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/upgrade/marketplace ───────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/upgrade/marketplace',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{
      original_plugin_unique_identifier: string
      new_plugin_unique_identifier: string
    }>()

    if (!body.original_plugin_unique_identifier || !body.new_plugin_unique_identifier) {
      return c.json({ code: 'invalid_param', message: 'original and new plugin unique identifiers are required' }, 400)
    }

    try {
      const response = await upgradePluginWithMarketplace(
        tenantId,
        body.original_plugin_unique_identifier,
        body.new_plugin_unique_identifier,
      )
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── POST /workspaces/current/plugin/upgrade/github ────────────────────────────

pluginInstallRoute.post(
  '/workspaces/current/plugin/upgrade/github',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const body = await c.req.json<{
      original_plugin_unique_identifier: string
      new_plugin_unique_identifier: string
      repo: string
      version: string
      package: string
    }>()

    if (!body.original_plugin_unique_identifier || !body.new_plugin_unique_identifier
        || !body.repo || !body.version || !body.package) {
      return c.json({ code: 'invalid_param', message: 'all fields are required' }, 400)
    }

    try {
      const response = await upgradePluginWithGithub(
        tenantId,
        body.original_plugin_unique_identifier,
        body.new_plugin_unique_identifier,
        body.repo,
        body.version,
        body.package,
      )
      return c.json(response)
    }
    catch (err) {
      return handlePluginError(c, err)
    }
  },
)

// ── Error helper ──────────────────────────────────────────────────────────────

function handlePluginError(c: { json: (data: unknown, status: number) => Response }, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('plugin_error') || message.includes('plugin daemon')) {
    return c.json({ code: 'plugin_error', message }, 400)
  }
  if (message.includes('not enabled') || message.includes('same plugin')) {
    return c.json({ code: 'invalid_param', message }, 400)
  }
  if (message.includes('File size exceeds')) {
    return c.json({ code: 'invalid_param', message }, 400)
  }
  throw err
}
