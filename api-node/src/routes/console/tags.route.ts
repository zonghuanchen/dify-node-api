/**
 * Tags route — mirrors Python api/controllers/console/tag/tags.py TagListApi.
 *
 * GET /console/api/tags?type=app
 *
 * Returns tags for the current workspace, filtered by type and optional keyword.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { tagService } from '../../services/tag.service.js'
import type { AppEnv } from '../../types/hono-env.js'

export const tagsRoute = new Hono<AppEnv>()

tagsRoute.get(
  '/tags',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Parse query params
    // type: "knowledge" | "app" | "snippet" | "" (defaults to "")
    const type = c.req.query('type') || ''
    const keyword = c.req.query('keyword') || undefined

    try {
      const result = await tagService.getTags(db, tenantId, type, keyword)
      return c.json(result)
    }
    catch (err) {
      console.error('[tags] getTags failed:', err)
      return c.json([])
    }
  },
)
