/**
 * Features route — mirrors Python api/controllers/console/feature.py FeatureApi.
 *
 * GET /console/api/features — tenant-level feature configuration
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
