/**
 * Workflows route — mirrors Python api/controllers/console/app/workflow.py and
 * api/controllers/console/app/workflow_trigger.py.
 *
 * GET /console/api/apps/:appId/workflows/draft
 * GET /console/api/apps/:appId/workflows/default-workflow-block-configs
 * GET /console/api/apps/:appId/triggers
 */

import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { apps } from '../../db/schema.js'
import defaultBlockConfigsJson from '../../data/default-block-configs.json' with { type: 'json' }
import { triggerService } from '../../services/trigger.service.js'
import { workflowDraftService } from '../../services/workflow-draft.service.js'
import type { AppEnv } from '../../types/hono-env.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Valid app modes for workflow endpoints
const WORKFLOW_MODES = new Set(['advanced-chat', 'workflow'])

// ── Static default block configs (imported at build time) ──────────────────
const defaultBlockConfigs: unknown[] = defaultBlockConfigsJson as unknown[]

// ── Route ────────────────────────────────────────────────────────────────────

export const workflowsRoute = new Hono<AppEnv>()

/**
 * GET /apps/:appId/workflows/draft
 * Returns the draft workflow for an app.
 * Mirrors Python DraftWorkflowApi.get() from workflow.py L502-539.
 */
workflowsRoute.get(
  '/apps/:appId/workflows/draft',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    if (!UUID_RE.test(appId)) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Verify app belongs to tenant and has a workflow-compatible mode
    const [app] = await db
      .select({ id: apps.id, mode: apps.mode })
      .from(apps)
      .where(and(eq(apps.id, appId), eq(apps.tenantId, tenantId)))
      .limit(1)

    if (!app) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    if (!WORKFLOW_MODES.has(app.mode)) {
      return c.json({ code: 'bad_request', message: 'App mode must be advanced-chat or workflow.' }, 400)
    }

    try {
      const result = await workflowDraftService.getDraftWorkflow(db, tenantId, appId)
      return c.json(result)
    }
    catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
        return c.json({ code: 'draft_workflow_not_exist', message: 'Draft workflow not found.' }, 404)
      }
      console.error('[workflows/draft] Error:', err)
      return c.json({ code: 'internal_error', message: 'Failed to load draft workflow.' }, 500)
    }
  },
)

/**
 * GET /apps/:appId/workflows/default-workflow-block-configs
 * Returns default block configurations for all workflow node types.
 * Mirrors Python DefaultBlockConfigsApi.get() from workflow.py L1233-1255.
 */
workflowsRoute.get(
  '/apps/:appId/workflows/default-workflow-block-configs',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    if (!UUID_RE.test(appId)) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Verify app belongs to tenant
    const [app] = await db
      .select({ id: apps.id, mode: apps.mode })
      .from(apps)
      .where(and(eq(apps.id, appId), eq(apps.tenantId, tenantId)))
      .limit(1)

    if (!app) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    return c.json(defaultBlockConfigs)
  },
)

/**
 * GET /apps/:appId/triggers
 * Returns the list of triggers for an app.
 * Mirrors Python AppTriggersApi.get() from workflow_trigger.py L128-164.
 */
workflowsRoute.get(
  '/apps/:appId/triggers',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    if (!UUID_RE.test(appId)) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Verify app belongs to tenant and is a workflow app
    const [app] = await db
      .select({ id: apps.id, mode: apps.mode })
      .from(apps)
      .where(and(eq(apps.id, appId), eq(apps.tenantId, tenantId)))
      .limit(1)

    if (!app) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    if (app.mode !== 'workflow') {
      return c.json({ code: 'bad_request', message: 'App mode must be workflow.' }, 400)
    }

    try {
      const result = await triggerService.getTriggers(db, tenantId, appId)
      return c.json(result)
    }
    catch (err) {
      console.error('[triggers] Error:', err)
      return c.json({ code: 'internal_error', message: 'Failed to load triggers.' }, 500)
    }
  },
)
