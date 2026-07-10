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
  },
)
