/**
 * Agent providers stub route.
 * Mirrors Python api/controllers/console/workspace/agent_providers.py.
 *
 * GET /console/api/workspaces/current/agent-providers
 *
 * This endpoint depends on the Python plugin system (graphon.model_runtime)
 * and cannot be directly migrated to api-node. Returns empty stub data
 * to prevent frontend errors.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const agentProvidersRoute = new Hono<AppEnv>()

/**
 * GET /workspaces/current/agent-providers
 * Returns list of available agent providers.
 * Mirrors Python AgentProviderListApi.get() from agent_providers.py L31-46.
 *
 * NOTE: Returns empty array stub — full implementation requires Python plugin system.
 */
agentProvidersRoute.get(
  '/workspaces/current/agent-providers',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    return c.json([])
  },
)
