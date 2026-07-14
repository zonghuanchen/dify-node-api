/**
 * Workflow comments route — mirrors Python api/controllers/console/app/workflow_comment.py.
 *
 * GET /console/api/apps/:appId/workflow/comments
 */

import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { apps } from '../../db/schema.js'
import { workflowCommentsService } from '../../services/workflow-comments.service.js'
import type { AppEnv } from '../../types/hono-env.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Route ────────────────────────────────────────────────────────────────────

export const workflowCommentsRoute = new Hono<AppEnv>()

/**
 * GET /apps/:appId/workflow/comments
 * Lists all comments for a workflow app.
 * Mirrors Python WorkflowCommentListApi.get() from workflow_comment.py L214-232.
 */
workflowCommentsRoute.get(
  '/apps/:appId/workflow/comments',
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
      .select({ id: apps.id })
      .from(apps)
      .where(and(eq(apps.id, appId), eq(apps.tenantId, tenantId)))
      .limit(1)

    if (!app) {
      return c.json({ code: 'not_found', message: 'App not found.' }, 404)
    }

    try {
      const result = await workflowCommentsService.getComments(db, tenantId, appId)
      return c.json(result)
    }
    catch (err) {
      console.error('[workflow/comments] Error:', err)
      return c.json({ code: 'internal_error', message: 'Failed to load workflow comments.' }, 500)
    }
  },
)
