/**
 * Plugin install tasks service.
 *
 * Mirrors Python `api/core/plugin/plugin_service.py` install task methods (L718-761)
 * and `api/core/plugin/impl/plugin.py` daemon calls (L154-203).
 *
 * Each method proxies to the Plugin Daemon inner API and handles cache
 * invalidation for terminal task states (success / failed).
 */

import { requestPluginDaemon } from '../lib/plugin-daemon.js'
import { redis } from '../lib/redis.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PluginInstallTaskStatus = 'pending' | 'running' | 'success' | 'failed'

const TERMINAL_STATUSES: ReadonlySet<PluginInstallTaskStatus> = new Set(['success', 'failed'])

export interface I18nObject {
  en_US: string
  zh_Hans?: string | null
  pt_BR?: string | null
  ja_JP?: string | null
}

export interface PluginInstallTaskPluginStatus {
  plugin_unique_identifier: string
  plugin_id: string
  status: PluginInstallTaskStatus
  message: string
  icon: string
  labels: I18nObject
  source?: string | null
}

export interface PluginInstallTask {
  id: string
  created_at: string
  updated_at: string
  status: PluginInstallTaskStatus
  total_plugins: number
  completed_plugins: number
  plugins: PluginInstallTaskPluginStatus[]
}

// ── Redis cache keys (mirror Python PluginService) ────────────────────────────

const CACHE_KEY_PREFIX = 'plugin_model_providers:tenant_id:'
const GENERATION_KEY_PREFIX = 'plugin_model_providers_generation:tenant_id:'

/**
 * Invalidate the tenant-scoped plugin model providers cache in Redis.
 * Mirrors Python `PluginService.invalidate_plugin_model_providers_cache`.
 */
async function invalidatePluginModelProvidersCache(tenantId: string): Promise<void> {
  const cacheKey = `${CACHE_KEY_PREFIX}${tenantId}`
  const generationKey = `${GENERATION_KEY_PREFIX}${tenantId}`
  try {
    const pipeline = redis.pipeline()
    pipeline.del(cacheKey)
    pipeline.incr(generationKey)
    await pipeline.exec()
  }
  catch {
    // Non-fatal: log and continue.
    console.warn(`Failed to invalidate plugin model providers cache for tenant ${tenantId}`)
  }
}

// ── Daemon path helpers ───────────────────────────────────────────────────────

function daemonPath(tenantId: string, suffix: string): string {
  return `plugin/${tenantId}/management/install/${suffix}`
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Fetch plugin installation tasks (paginated).
 * Mirrors Python `PluginService.fetch_install_tasks`.
 */
export async function fetchInstallTasks(
  tenantId: string,
  page: number,
  pageSize: number,
): Promise<PluginInstallTask[]> {
  const tasks = await requestPluginDaemon<PluginInstallTask[]>(
    'GET',
    daemonPath(tenantId, 'tasks'),
    { params: { page, page_size: pageSize } },
  )

  // Invalidate cache if any task is in a terminal state.
  if (tasks.some((t) => TERMINAL_STATUSES.has(t.status))) {
    await invalidatePluginModelProvidersCache(tenantId)
  }

  return tasks
}

/**
 * Fetch a single plugin installation task by ID.
 * Mirrors Python `PluginService.fetch_install_task`.
 */
export async function fetchInstallTask(
  tenantId: string,
  taskId: string,
): Promise<PluginInstallTask> {
  const task = await requestPluginDaemon<PluginInstallTask>(
    'GET',
    daemonPath(tenantId, `tasks/${taskId}`),
  )

  if (TERMINAL_STATUSES.has(task.status)) {
    await invalidatePluginModelProvidersCache(tenantId)
  }

  return task
}

/**
 * Delete a plugin installation task.
 * Mirrors Python `PluginService.delete_install_task`.
 */
export async function deleteInstallTask(
  tenantId: string,
  taskId: string,
): Promise<boolean> {
  return requestPluginDaemon<boolean>(
    'POST',
    daemonPath(tenantId, `tasks/${taskId}/delete`),
  )
}

/**
 * Delete all plugin installation task items.
 * Mirrors Python `PluginService.delete_all_install_task_items`.
 */
export async function deleteAllInstallTaskItems(
  tenantId: string,
): Promise<boolean> {
  return requestPluginDaemon<boolean>(
    'POST',
    daemonPath(tenantId, 'tasks/delete_all'),
  )
}

/**
 * Delete a single plugin installation task item.
 * Mirrors Python `PluginService.delete_install_task_item`.
 */
export async function deleteInstallTaskItem(
  tenantId: string,
  taskId: string,
  identifier: string,
): Promise<boolean> {
  return requestPluginDaemon<boolean>(
    'POST',
    daemonPath(tenantId, `tasks/${taskId}/delete/${identifier}`),
  )
}
