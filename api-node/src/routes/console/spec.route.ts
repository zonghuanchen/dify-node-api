/**
 * Spec route — mirrors Python api/controllers/console/spec.py.
 *
 * GET /console/api/spec/schema-definitions
 *
 * Schema definitions come from the Python plugin registry (graphon.model_runtime).
 * Since api-node has no access to that registry, we return an empty array stub
 * to prevent frontend errors.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import type { AppEnv } from '../../types/hono-env.js'

export const specRoute = new Hono<AppEnv>()

/**
 * GET /spec/schema-definitions
 * Returns system JSON Schema definitions for frontend component type mapping.
 * Mirrors Python SpecSchemaDefinitionsApi.get() from spec.py L27-45.
 *
 * NOTE: Returns empty array stub — full implementation requires Python plugin system.
 */
specRoute.get(
  '/spec/schema-definitions',
  requireAuth,
  requireAccountInitialized,
  (c) => {
    return c.json([])
  },
)
