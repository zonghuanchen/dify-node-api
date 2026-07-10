/**
 * Model providers stub routes.
 * Mirrors Python api/controllers/console/workspace/model_providers.py and models.py.
 *
 * These endpoints depend on the Python plugin system (graphon.model_runtime)
 * and cannot be directly migrated to api-node. They return empty stub data
 * to prevent frontend errors.
 *
 * GET /console/api/workspaces/current/model-providers
 * GET /console/api/workspaces/current/models/model-types/:model_type
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const modelProvidersRoute = new Hono<AppEnv>()

// GET /workspaces/current/model-providers
modelProvidersRoute.get(
  '/workspaces/current/model-providers',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    // Stub: return empty provider list.
    // Full implementation requires Python plugin system (graphon.model_runtime).
    return c.json({ data: [] })
  },
)

// GET /workspaces/current/models/model-types/:model_type
modelProvidersRoute.get(
  '/workspaces/current/models/model-types/:model_type',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    // Stub: return empty models list.
    // Full implementation requires Python plugin system (graphon.model_runtime).
    return c.json({ data: [] })
  },
)
