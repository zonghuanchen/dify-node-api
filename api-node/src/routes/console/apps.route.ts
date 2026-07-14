/**
 * Apps route — mirrors Python api/controllers/console/app/app.py AppListApi.
 *
 * GET /console/api/apps
 *
 * Returns paginated app list with filters, sorting, and star markers.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { appService, type AppListSortBy } from '../../services/app.service.js'
import type { AppEnv } from '../../types/hono-env.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const appsRoute = new Hono<AppEnv>()

appsRoute.get(
  '/apps',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const accountId = c.get('accountId')!
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Parse query params
    const page = Math.max(1, Number(c.req.query('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 30))
    const mode = c.req.query('mode') || undefined
    const sortBy = (c.req.query('sort_by') || 'last_modified') as AppListSortBy
    const name = c.req.query('name') || undefined
    const isCreatedByMe = c.req.query('is_created_by_me') === 'true'

    // creator_ids can be comma-separated
    const creatorIdsRaw = c.req.query('creator_ids')
    const creatorIds = creatorIdsRaw ? creatorIdsRaw.split(',').filter(Boolean) : undefined

    try {
      const result = await appService.getPaginateApps(db, accountId, tenantId, {
        page,
        limit,
        mode,
        sortBy,
        name,
        creatorIds,
        isCreatedByMe,
      })

      return c.json(result)
    }
    catch (err) {
      console.error('[apps] getPaginateApps failed:', err)
      return c.json({ page, limit, total: 0, has_more: false, data: [] })
    }
  },
)

/**
 * GET /console/api/apps/starred
 *
 * Returns paginated starred apps for the authenticated user.
 * Mirrors Python `StarredAppListApi` from app.py L658.
 *
 * NOTE: Must be registered before any /apps/:id parameter routes.
 */
appsRoute.get(
  '/apps/starred',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const accountId = c.get('accountId')!
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Parse query params
    const page = Math.max(1, Number(c.req.query('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 30))
    const mode = c.req.query('mode') || undefined
    const sortBy = (c.req.query('sort_by') || 'last_modified') as AppListSortBy
    const name = c.req.query('name') || undefined
    const isCreatedByMe = c.req.query('is_created_by_me') === 'true'

    const creatorIdsRaw = c.req.query('creator_ids')
    const creatorIds = creatorIdsRaw ? creatorIdsRaw.split(',').filter(Boolean) : undefined

    try {
      const result = await appService.getPaginateStarredApps(db, accountId, tenantId, {
        page,
        limit,
        mode,
        sortBy,
        name,
        creatorIds,
        isCreatedByMe,
      })

      return c.json(result)
    }
    catch (err) {
      console.error('[apps] getPaginateStarredApps failed:', err)
      return c.json({ page, limit, total: 0, has_more: false, data: [] })
    }
  },
)

/**
 * GET /console/api/apps/:appId
 *
 * Returns full app detail with site, workflow, tags, and starred status.
 * Mirrors Python `AppApi.get` from app.py L728.
 *
 * NOTE: Must be registered AFTER /apps/starred to avoid route conflict.
 */
appsRoute.get(
  '/apps/:appId',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    // Validate UUID format
    if (!UUID_RE.test(appId)) {
      return c.json({ message: 'App not found' }, 404)
    }

    const accountId = c.get('accountId')!
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    try {
      const result = await appService.getAppById(db, accountId, tenantId, appId)
      if (!result) {
        return c.json({ message: 'App not found' }, 404)
      }
      return c.json(result)
    }
    catch (err) {
      console.error('[apps] getAppById failed:', err)
      return c.json({ message: 'Internal server error' }, 500)
    }
  },
)
