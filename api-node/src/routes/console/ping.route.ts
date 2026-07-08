import { Hono } from 'hono'

/**
 * GET /console/api/ping
 * Health check endpoint for Console API.
 */
export const pingRoute = new Hono()

pingRoute.get('/ping', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})
