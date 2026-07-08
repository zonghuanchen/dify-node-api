import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../../types/hono-env.js'
import { workflowService, workflowRunPayloadSchema, serializeWorkflowRun } from '../../services/workflow.service.js'
import { AuthError, BadRequestError } from '../../lib/errors.js'

const workflowRunRoute = new Hono<AppEnv>()

// ── Service API auth middleware ──────────────────────────────────────────────
// Extracts and validates the Bearer API token, then sets `serviceApiApp` on context.
// Mirrors Python `validate_app_token` decorator.
const requireApiToken: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('API token required. Provide it via Authorization: Bearer <token> header.')
  }
  const token = authHeader.slice(7)
  if (!token) {
    throw new AuthError('API token required.')
  }

  const db = c.get('db')
  const app = await workflowService.validateApiToken(db, token)
  c.set('serviceApiApp', app)
  await next()
}

// Apply API token auth to all routes in this group
workflowRunRoute.use('*', requireApiToken)

/**
 * GET /workflows/run/:workflow_run_id
 * Retrieves execution details of a specific workflow run.
 *
 * Mirrors Python: service_api/app/workflow.py WorkflowRunDetailApi.get()
 * Route: GET /v1/workflows/run/<workflow_run_id>
 */
workflowRunRoute.get(
  '/workflows/run/:workflow_run_id',
  async (c) => {
    const workflowRunId = c.req.param('workflow_run_id')
    if (!workflowRunId) {
      throw new BadRequestError('workflow_run_id is required.')
    }

    const db = c.get('db')
    const app = c.get('serviceApiApp')!

    // App mode check — allow both workflow and advanced_chat
    if (app.mode !== 'workflow' && app.mode !== 'advanced-chat') {
      throw new BadRequestError('App mode does not support workflow runs.')
    }

    const run = await workflowService.getWorkflowRunById(db, app, workflowRunId)
    return c.json(serializeWorkflowRun(run))
  },
)

/**
 * POST /workflows/:workflow_id/run
 * Executes a specific workflow version by its ID.
 *
 * Mirrors Python: service_api/app/workflow.py WorkflowRunByIdApi.post()
 * Route: POST /v1/workflows/<workflow_id>/run
 *
 * Request body:
 *   - inputs: Record<string, unknown>  (workflow input variables)
 *   - files?: Array<FileItem>          (optional file inputs)
 *   - response_mode?: "blocking" | "streaming"
 *   - user?: string                    (end-user identifier)
 */
workflowRunRoute.post(
  '/workflows/:workflow_id/run',
  async (c) => {
    const workflowId = c.req.param('workflow_id')
    if (!workflowId) {
      throw new BadRequestError('workflow_id is required.')
    }

    const db = c.get('db')
    const app = c.get('serviceApiApp')!

    // Parse and validate body
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw new BadRequestError('Request body must be valid JSON.')
    }

    const parsed = workflowRunPayloadSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestError(`Invalid request body: ${parsed.error.message}`)
    }

    const payload = parsed.data

    // Extract user identifier from body (Service API convention)
    const userBody = (body as Record<string, unknown>)?.user
    const endUser = await workflowService.getOrCreateEndUser(
      db,
      app,
      typeof userBody === 'string' ? { user: userBody } : undefined,
    )

    // Create workflow run (execution delegated to Python backend via Celery)
    const run = await workflowService.runWorkflow(db, app, endUser, payload, workflowId)

    return c.json(serializeWorkflowRun(run), 200)
  },
)

export { workflowRunRoute }
