/**
 * Trigger providers stub route.
 * Mirrors Python api/controllers/console/workspace/trigger_providers.py.
 *
 * GET /console/api/workspaces/current/triggers
 *
 * This endpoint depends on the Python plugin system (TriggerProviderService).
 * Returns empty stub data to prevent frontend errors.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const triggerProvidersRoute = new Hono<AppEnv>()

/**
 * GET /workspaces/current/triggers
 * Lists trigger providers for the current tenant.
 * Mirrors Python TriggerProviderListApi.get() from trigger_providers.py L183-192.
 *
 * NOTE: Returns empty array stub — full implementation requires Python plugin system.
 */
triggerProvidersRoute.get(
  '/workspaces/current/triggers',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    return c.json([])
  },
)
