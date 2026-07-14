/**
 * Developer API Settings route.
 *
 * GET /console/api/enterprise/app-deploy/appInstances/:appInstanceId/developerApiSettings
 *
 * Returns access channels, API keys, environments, and developer API URL for a given app.
 * This is an enterprise contract endpoint with no open-source Python implementation;
 * the response is assembled from local api_tokens/apps tables.
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import { developerApiService } from '../../../services/developer-api.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const developerApiSettingsRoute = new Hono<AppEnv>()

developerApiSettingsRoute.get(
  '/enterprise/app-deploy/appInstances/:appInstanceId/developerApiSettings',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appInstanceId = c.req.param('appInstanceId')

    if (!UUID_RE.test(appInstanceId)) {
      return c.json({ message: 'App not found' }, 404)
    }

    const accountId = c.get('accountId')!
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    try {
      const result = await developerApiService.getSettings(db, accountId, tenantId, appInstanceId)
      if (!result) {
        return c.json({ message: 'App not found' }, 404)
      }
      return c.json(result)
    }
    catch (err) {
      console.error('[developerApiSettings] getSettings failed:', err)
      return c.json({ message: 'Internal server error' }, 500)
    }
  },
)
