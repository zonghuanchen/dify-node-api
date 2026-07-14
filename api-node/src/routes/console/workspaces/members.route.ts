/**
 * Members route — mirrors Python api/controllers/console/workspace/members.py MemberListApi.
 *
 * GET /console/api/workspaces/current/members
 *
 * Returns all members of the current workspace with their roles.
 */

import { Hono } from 'hono'
import { NotFoundError } from '../../../lib/errors.js'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { workspaceService } from '../../../services/workspace.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const membersRoute = new Hono<AppEnv>()

membersRoute.get(
  '/workspaces/current/members',
  requireAuth,
  requireAccountInitialized,
  async (c) => {
    const accountId = c.get('accountId')!
    const db = c.get('db')

    // 1. Resolve current tenant for the authenticated user
    const currentTenant = await workspaceService.getCurrentTenant(db, accountId)
    if (!currentTenant) {
      throw new NotFoundError('No current tenant')
    }

    // 2. Fetch and return tenant members
    const result = await workspaceService.getTenantMembers(db, currentTenant.id)
    return c.json(result)
  },
)
