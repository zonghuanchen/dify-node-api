/**
 * Workflow variables route — mirrors Python api/controllers/console/app/workflow_draft_variable.py.
 *
 * GET /console/api/apps/:appId/workflows/draft/variables
 * GET /console/api/apps/:appId/workflows/draft/conversation-variables
 * GET /console/api/apps/:appId/workflows/draft/system-variables
 */

import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { apps } from '../../db/schema.js'
import { workflowVariablesService } from '../../services/workflow-variables.service.js'
import type { AppEnv } from '../../types/hono-env.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const WORKFLOW_MODES = new Set(['advanced-chat', 'workflow'])

// ── Route ────────────────────────────────────────────────────────────────────

export const workflowVariablesRoute = new Hono<AppEnv>()

/**
 * GET /apps/:appId/workflows/draft/variables
 * Lists workflow variables without values (paginated).
 * Mirrors Python WorkflowVariableCollectionApi.get() from workflow_draft_variable.py L319-356.
 */
workflowVariablesRoute.get(
  '/apps/:appId/workflows/draft/variables',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    if (!UUID_RE.test(appId)) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    const tenantId = c.get('tenantId')!
    const accountId = c.get('accountId')!
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
      // Check draft workflow exists
      await workflowVariablesService.ensureDraftWorkflowExists(db, tenantId, appId)

      const page = Math.max(1, Number(c.req.query('page')) || 1)
      const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20))

      const result = await workflowVariablesService.listVariables(db, appId, accountId, page, limit)
      return c.json(result)
    }
    catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
        return c.json({ code: 'draft_workflow_not_exist', message: 'Draft workflow not found.' }, 404)
      }
      console.error('[workflows/draft/variables] Error:', err)
      return c.json({ code: 'internal_error', message: 'Failed to load workflow variables.' }, 500)
    }
  },
)

/**
 * GET /apps/:appId/workflows/draft/conversation-variables
 * Lists conversation variables with values.
 * Mirrors Python ConversationVariableCollectionApi.get() from workflow_draft_variable.py L595-615.
 */
workflowVariablesRoute.get(
  '/apps/:appId/workflows/draft/conversation-variables',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    if (!UUID_RE.test(appId)) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    const tenantId = c.get('tenantId')!
    const accountId = c.get('accountId')!
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
      const result = await workflowVariablesService.listConversationVariables(db, appId, accountId)
      return c.json(result)
    }
    catch (err) {
      console.error('[workflows/draft/conversation-variables] Error:', err)
      return c.json({ code: 'internal_error', message: 'Failed to load conversation variables.' }, 500)
    }
  },
)

/**
 * GET /apps/:appId/workflows/draft/system-variables
 * Lists system variables with values.
 * Mirrors Python SystemVariableCollectionApi.get() from workflow_draft_variable.py L654-664.
 */
workflowVariablesRoute.get(
  '/apps/:appId/workflows/draft/system-variables',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const appId = c.req.param('appId')

    if (!UUID_RE.test(appId)) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    const tenantId = c.get('tenantId')!
    const accountId = c.get('accountId')!
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
      const result = await workflowVariablesService.listSystemVariables(db, appId, accountId)
      return c.json(result)
    }
    catch (err) {
      console.error('[workflows/draft/system-variables] Error:', err)
      return c.json({ code: 'internal_error', message: 'Failed to load system variables.' }, 500)
    }
  },
)
