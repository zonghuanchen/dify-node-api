/**
 * Features route — mirrors Python api/controllers/console/feature.py.
 *
 * GET /console/api/features          — tenant-level feature configuration
 * GET /console/api/app-dsl-version   — current app DSL version
 *
 * Auth flow:
 * 1. requireAuth — verifies JWT
 * 2. requireAccountInitialized — checks account initialized
 * 3. resolveTenant — resolves current tenant
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { getFeatures } from '../../services/feature.service.js'
import type { AppEnv } from '../../types/hono-env.js'

/** Mirrors Python constant api/constants/dsl_version.py CURRENT_APP_DSL_VERSION. */
const CURRENT_APP_DSL_VERSION = '0.6.0'

export const featuresRoute = new Hono<AppEnv>()

featuresRoute.get(
  '/features',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  (c) => {
    const tenantId = c.get('tenantId')!
    return c.json(getFeatures(tenantId))
  },
)

/**
 * GET /app-dsl-version
 * Returns current app DSL version for workflow clipboard compatibility.
 * Mirrors Python AppDslVersionApi.get() from feature.py L104-118.
 */
featuresRoute.get(
  '/app-dsl-version',
  (c) => {
    return c.json({ app_dsl_version: CURRENT_APP_DSL_VERSION })
  },
)
