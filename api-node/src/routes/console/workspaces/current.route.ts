import { Hono } from 'hono'
import { AuthError, NotFoundError } from '../../../lib/errors.js'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { workspaceService } from '../../../services/workspace.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

/**
 * POST /console/api/workspaces/current
 *
 * Returns the current workspace info for the authenticated user.
 * Mirrors Python `TenantApi` (POST /console/api/workspaces/current).
 *
 * Auth flow:
 * 1. `requireAuth` — verifies JWT and sets accountId
 * 2. `requireAccountInitialized` — checks account.status !== 'uninitialized'
 * 3. Handler — resolves current tenant, handles archived workspaces
 *
 * NOTE: Uses POST (not GET) to match the Python API contract, even though
 * it does not mutate state. This is the existing Dify convention.
 */
export const workspaceCurrentRoute = new Hono<AppEnv>()

workspaceCurrentRoute.post(
  '/workspaces/current',
  requireAuth,
  requireAccountInitialized,
  async (c) => {
    const accountId = c.get('accountId')!
    const db = c.get('db')

    // 1. Get current tenant
    let currentTenant = await workspaceService.getCurrentTenant(db, accountId)

    // 2. Handle archived tenant — auto-switch to the first available active tenant
    if (currentTenant && currentTenant.status === 'archive') {
      const activeTenants = await workspaceService.getActiveTenants(db, accountId)

      if (activeTenants.length > 0) {
        const firstActive = activeTenants[0]!
        await workspaceService.switchTenant(db, accountId, firstActive.id)
        currentTenant = firstActive
      }
      else {
        throw new AuthError('workspace is archived')
      }
    }

    // 3. No current tenant found
    if (!currentTenant) {
      throw new NotFoundError('No current tenant')
    }

    // 4. Build and return tenant info
    const info = await workspaceService.getTenantInfo(db, currentTenant.id, accountId)
    return c.json(info)
  },
)
