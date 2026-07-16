/**
 * Plugin install tasks routes.
 *
 * Mirrors Python `api/controllers/console/workspace/plugin.py` L812-887.
 *
 * GET  /console/api/workspaces/current/plugin/tasks
 * GET  /console/api/workspaces/current/plugin/tasks/:task_id
 * POST /console/api/workspaces/current/plugin/tasks/:task_id/delete
 * POST /console/api/workspaces/current/plugin/tasks/delete_all
 * POST /console/api/workspaces/current/plugin/tasks/:task_id/delete/:identifier
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { requirePluginInstallPermission } from '../../../middleware/plugin-permission.js'
import { resolveTenant } from '../../../middleware/tenant.js'
import {
  deleteAllInstallTaskItems,
  deleteInstallTask,
  deleteInstallTaskItem,
  fetchInstallTask,
  fetchInstallTasks,
} from '../../../services/plugin-tasks.service.js'
import type { AppEnv } from '../../../types/hono-env.js'

export const pluginTasksRoute = new Hono<AppEnv>()

/** Shared middleware chain for all plugin task endpoints. */
const mw = [requireAuth, requireAccountInitialized, resolveTenant, requirePluginInstallPermission] as const

// ── GET /workspaces/current/plugin/tasks ──────────────────────────────────────

pluginTasksRoute.get(
  '/workspaces/current/plugin/tasks',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const page = Number(c.req.query('page') || '1')
    const pageSize = Number(c.req.query('page_size') || '256')

    // Clamp page_size to 1-256 (mirrors Python ParserTasks validation).
    const clampedPageSize = Math.max(1, Math.min(256, pageSize))
    const clampedPage = Math.max(1, page)

    const tasks = await fetchInstallTasks(tenantId, clampedPage, clampedPageSize)
    return c.json({ tasks })
  },
)

// ── POST /workspaces/current/plugin/tasks/delete_all ──────────────────────────
// Must be registered BEFORE the parameterised `:task_id` routes to avoid
// Hono matching "delete_all" as a task_id value.

pluginTasksRoute.post(
  '/workspaces/current/plugin/tasks/delete_all',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const success = await deleteAllInstallTaskItems(tenantId)
    return c.json({ success })
  },
)

// ── GET /workspaces/current/plugin/tasks/:task_id ─────────────────────────────

pluginTasksRoute.get(
  '/workspaces/current/plugin/tasks/:task_id',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const taskId = c.req.param('task_id')
    const task = await fetchInstallTask(tenantId, taskId)
    return c.json({ task })
  },
)

// ── POST /workspaces/current/plugin/tasks/:task_id/delete ─────────────────────

pluginTasksRoute.post(
  '/workspaces/current/plugin/tasks/:task_id/delete',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const taskId = c.req.param('task_id')
    const success = await deleteInstallTask(tenantId, taskId)
    return c.json({ success })
  },
)

// ── POST /workspaces/current/plugin/tasks/:task_id/delete/:identifier ─────────

pluginTasksRoute.post(
  '/workspaces/current/plugin/tasks/:task_id/delete/:identifier',
  ...mw,
  async (c) => {
    const tenantId = c.get('tenantId')!
    const taskId = c.req.param('task_id')
    const identifier = c.req.param('identifier')
    const success = await deleteInstallTaskItem(tenantId, taskId, identifier)
    return c.json({ success })
  },
)
