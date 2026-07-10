/**
 * Workspaces list route.
 * Mirrors Python api/controllers/console/workspace/workspace.py TenantListApi.
 *
 * GET /console/api/workspaces
 *
 * Returns all workspaces the authenticated user belongs to.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import { workspaceService } from '../../../services/workspace.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const workspaceListRoute = new Hono<AppEnv>()

workspaceListRoute.get(
  '/workspaces',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const accountId = c.get('accountId')!
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    const workspaces = await workspaceService.getWorkspacesForAccount(db, accountId, tenantId)
    return c.json({ workspaces })
  },
)
