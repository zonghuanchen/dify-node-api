/**
 * GET /console/api/workspaces/current/rbac/my-permissions
 *
 * Returns the current user's RBAC permissions across workspace, app, and dataset.
 * Mirrors Python `RBACMyPermissionsApi` in api/controllers/console/workspace/rbac.py.
 *
 * Auth flow:
 * 1. `requireAuth` — verifies JWT and sets accountId
 * 2. `requireAccountInitialized` — checks account.status !== 'uninitialized'
 * 3. `resolveTenant` — resolves current tenant, sets tenantId + tenantRole
 * 4. Handler — delegates to rbacService.getMyPermissions()
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import { rbacService } from '../../../services/rbac.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const rbacRoute = new Hono<AppEnv>()

rbacRoute.get(
  '/workspaces/current/rbac/my-permissions',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const accountId = c.get('accountId')!
    const db = c.get('db')

    const appId = c.req.query('app_id') || undefined
    const datasetId = c.req.query('dataset_id') || undefined

    const result = await rbacService.getMyPermissions(db, tenantId, accountId, appId, datasetId)
    return c.json(result)
  },
)
