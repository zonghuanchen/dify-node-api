/**
 * Tool providers stub route.
 * Mirrors Python api/controllers/console/workspace/tool_providers.py.
 *
 * GET /console/api/workspaces/current/tool-providers
 *
 * This endpoint depends on the Python plugin system and tool provider registry.
 * Cannot be directly migrated to api-node. Returns empty stub data
 * to prevent frontend errors.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const toolProvidersRoute = new Hono<AppEnv>()

/**
 * GET /workspaces/current/tool-providers
 * Returns list of tool provider collections.
 * Mirrors Python ToolProviderListApi from tool_providers.py L330+.
 *
 * NOTE: Returns empty array stub — full implementation requires Python plugin system.
 */
toolProvidersRoute.get(
  '/workspaces/current/tool-providers',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    return c.json([])
  },
)
