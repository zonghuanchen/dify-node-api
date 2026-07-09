import { config as loadDotenv } from 'dotenv'
loadDotenv()
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { config } from './config/index.js'
import { db } from './db/index.js'
import { redis } from './lib/redis.js'
import { errorHandler } from './middleware/error-handler.js'
import { pingDbRoute } from './routes/_dev/ping-db.route.js'
import { loginRoute } from './routes/console/auth/login.route.js'
import { registerRoute } from './routes/console/auth/register.route.js'
import { pingRoute } from './routes/console/ping.route.js'
import { systemFeaturesRoute } from './routes/console/system-features.route.js'
import { versionRoute } from './routes/console/version.route.js'
import { workspaceCurrentRoute } from './routes/console/workspaces/current.route.js'
import { workflowRunRoute } from './routes/v1/workflow-run.route.js'
import type { AppEnv } from './types/hono-env.js'

const app = new Hono<AppEnv>()

// ── Global Middlewares ─────────────────────────────────────────────
app.use('*', logger())
app.use('*', cors({
  origin: config.corsOrigins,
  credentials: true,
}))

// Inject DB instance into context
app.use('*', async (c, next) => {
  c.set('db', db)
  await next()
})

// ── Health Check (used by Docker healthcheck) ─────────────────────
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Console API Routes (/console/api) ──────────────────────────────
app.route('/console/api', pingRoute)
app.route('/console/api', versionRoute)

// Auth routes (public — no requireAuth middleware)
app.route('/console/api', loginRoute)
app.route('/console/api', registerRoute)

// System features (public by design — needed for dashboard init)
app.route('/console/api', systemFeaturesRoute)

// Workspace routes (authenticated)
app.route('/console/api', workspaceCurrentRoute)

// ── Service API Routes (/v1) — API token auth ─────────────────────
app.route('/v1', workflowRunRoute)

// ── Dev-only Routes ────────────────────────────────────────────────
if (config.isDev) {
  app.route('/', pingDbRoute)
}

// ── Error Handler ──────────────────────────────────────────────────
app.onError(errorHandler)

// ── 404 Handler ────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json(
    {
      status: 'error',
      code: 'not_found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404,
  )
})

// ── Start Server (skip in test environment) ───────────────────────
if (config.env !== 'test') {
  // Connect Redis (lazy — won't block startup)
  redis.connect().catch((err) => {
    console.warn('[api-node] Redis connection failed (non-fatal):', err.message)
  })

  serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    (info) => {
      console.log(`[api-node] Listening on http://${info.address}:${info.port}`)
    },
  )
}

export default app
