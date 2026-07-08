import { Hono } from 'hono'
import { config } from '../../config/index.js'

/**
 * GET /console/api/version
 * Returns the current application version.
 */
export const versionRoute = new Hono()

versionRoute.get('/version', (c) => {
  return c.json({ version: config.appVersion })
})
