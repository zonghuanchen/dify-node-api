import { Hono } from 'hono'
import { tryGetAccountId } from '../../lib/optional-auth.js'
import { getSystemFeatures } from '../../services/feature.service.js'
import type { AppEnv } from '../../types/hono-env.js'

/**
 * GET /console/api/system-features
 *
 * Returns system-wide feature flags and configuration.
 *
 * NOTE: This endpoint is unauthenticated by design, as it provides system features
 * data required for dashboard initialization. Authentication would create a circular
 * dependency (can't login without dashboard loading).
 *
 * Only non-sensitive configuration data should be returned by this endpoint.
 *
 * Mirrors Python: api/controllers/console/feature.py `SystemFeatureApi`.
 */
export const systemFeaturesRoute = new Hono<AppEnv>()

systemFeaturesRoute.get('/system-features', (c) => {
  const isAuthenticated = tryGetAccountId(c) !== null
  return c.json(getSystemFeatures(isAuthenticated))
})
