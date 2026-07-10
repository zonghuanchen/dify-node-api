/**
 * Installed Apps routes — mirrors Python api/controllers/console/explore/installed_app.py.
 *
 * Endpoints:
 *   GET    /console/api/installed-apps                  — list installed apps
 *   POST   /console/api/installed-apps                  — install an app
 *   DELETE /console/api/installed-apps/:installed_app_id — uninstall an app
 *   PATCH  /console/api/installed-apps/:installed_app_id — update (pin/unpin)
 *
 * Auth flow (all endpoints):
 * 1. requireAuth — verifies JWT, sets accountId
 * 2. requireAccountInitialized — checks account.status !== 'uninitialized'
 * 3. resolveTenant — resolves current tenant, sets tenantId + tenantRole
 * 4. Handler — delegates to installedAppsService
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { installedAppsService } from '../../services/installed-apps.service.js'
import type { AppEnv } from '../../types/hono-env.js'
import { and, eq } from 'drizzle-orm'
import { installedApps } from '../../db/schema.js'
import { NotFoundError } from '../../lib/errors.js'

export const installedAppsRoute = new Hono<AppEnv>()

// ── GET /installed-apps ────────────────────────────────────────────
installedAppsRoute.get(
  '/installed-apps',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const tenantRole = c.get('tenantRole') ?? 'normal'
    const db = c.get('db')

    const appIdFilter = c.req.query('app_id') || undefined

    const result = await installedAppsService.listInstalledApps(
      db,
      tenantId,
      tenantRole,
      appIdFilter,
    )
    return c.json(result)
  },
)

// ── POST /installed-apps ───────────────────────────────────────────
installedAppsRoute.post(
  '/installed-apps',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    const body = await c.req.json<{ app_id: string }>()
    const appId = body.app_id
    if (!appId) {
      return c.json({ code: 'bad_request', message: 'app_id is required' }, 400)
    }

    // NOTE: cloud_edition_billing_resource_check("apps") is stubbed.
    // In production, this would check app quota limits.

    const result = await installedAppsService.installApp(db, tenantId, appId)
    return c.json(result)
  },
)

// ── DELETE /installed-apps/:installed_app_id ───────────────────────
installedAppsRoute.delete(
  '/installed-apps/:installed_app_id',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const installedAppId = c.req.param('installed_app_id')
    const db = c.get('db')

    // Verify the installed_app belongs to this tenant (mirrors installed_app_required decorator)
    const [record] = await db
      .select()
      .from(installedApps)
      .where(
        and(
          eq(installedApps.id, installedAppId),
          eq(installedApps.tenantId, tenantId),
        ),
      )
      .limit(1)

    if (!record) {
      throw new NotFoundError('Installed app not found')
    }

    await installedAppsService.uninstallApp(db, installedAppId, tenantId)
    return c.body(null, 204)
  },
)

// ── PATCH /installed-apps/:installed_app_id ────────────────────────
installedAppsRoute.patch(
  '/installed-apps/:installed_app_id',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const installedAppId = c.req.param('installed_app_id')
    const db = c.get('db')

    const body = await c.req.json<{ is_pinned?: boolean }>()

    const result = await installedAppsService.updateInstalledApp(
      db,
      installedAppId,
      tenantId,
      { isPinned: body.is_pinned },
    )
    return c.json(result)
  },
)
