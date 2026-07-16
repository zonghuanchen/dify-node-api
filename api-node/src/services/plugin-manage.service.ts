/**
 * Plugin management service — permission, auto-upgrade, and listing endpoints.
 *
 * Mirrors Python:
 * - `api/services/plugin/plugin_permission_service.py`
 * - `api/services/plugin/plugin_auto_upgrade_service.py`
 * - `api/core/plugin/plugin_service.py` list methods
 */

import { and, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import { config } from '../config/index.js'
import {
  accountPluginPermissions,
  tenantPluginAutoUpgradeStrategies,
} from '../db/schema.js'
import { requestPluginDaemon } from '../lib/plugin-daemon.js'
import type { Database } from '../db/index.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PluginCategory = 'tool' | 'model' | 'extension' | 'agent-strategy' | 'datasource' | 'trigger'
export type StrategySetting = 'disabled' | 'fix_only' | 'latest'
export type UpgradeMode = 'all' | 'partial' | 'exclude'

export interface PluginPermission {
  installPermission: string
  debugPermission: string
}

export interface AutoUpgradeStrategy {
  strategySetting: StrategySetting
  upgradeTimeOfDay: number
  upgradeMode: UpgradeMode
  excludePlugins: string[]
  includePlugins: string[]
}

export interface AutoUpgradeFetchResponse {
  category: PluginCategory
  autoUpgrade: AutoUpgradeStrategy
}

const ADMIN_ROLES = new Set(['owner', 'admin'])

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'tool', 'model', 'extension', 'agent-strategy', 'datasource', 'trigger',
])
const VALID_STRATEGY_SETTINGS: ReadonlySet<string> = new Set(['disabled', 'fix_only', 'latest'])
const VALID_UPGRADE_MODES: ReadonlySet<string> = new Set(['all', 'partial', 'exclude'])

const SECONDS_PER_DAY = 86400
const AUTO_UPGRADE_CHECK_SLOT_SECONDS = 900 // 15 minutes
const AUTO_UPGRADE_CHECK_SLOT_COUNT = SECONDS_PER_DAY / AUTO_UPGRADE_CHECK_SLOT_SECONDS

const ENDPOINT_RECONCILIATION_PAGE_SIZE = 256

// ── Permission service functions ──────────────────────────────────────────────

/**
 * Get plugin permissions for a tenant.
 * Mirrors Python `PluginPermissionService.get_permission`.
 */
export async function getPluginPermission(
  db: Database,
  tenantId: string,
): Promise<PluginPermission> {
  const [row] = await db
    .select({
      installPermission: accountPluginPermissions.installPermission,
      debugPermission: accountPluginPermissions.debugPermission,
    })
    .from(accountPluginPermissions)
    .where(eq(accountPluginPermissions.tenantId, tenantId))
    .limit(1)

  if (!row) {
    return { installPermission: 'everyone', debugPermission: 'everyone' }
  }

  return {
    installPermission: row.installPermission,
    debugPermission: row.debugPermission,
  }
}

/**
 * Change plugin permissions for a tenant.
 * Mirrors Python `PluginPermissionService.change_permission`.
 */
export async function changePluginPermission(
  db: Database,
  tenantId: string,
  installPermission: string,
  debugPermission: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: accountPluginPermissions.id })
    .from(accountPluginPermissions)
    .where(eq(accountPluginPermissions.tenantId, tenantId))
    .limit(1)

  if (!existing) {
    await db.insert(accountPluginPermissions).values({
      id: uuidv4(),
      tenantId,
      installPermission,
      debugPermission,
    })
  }
  else {
    await db
      .update(accountPluginPermissions)
      .set({ installPermission, debugPermission })
      .where(eq(accountPluginPermissions.tenantId, tenantId))
  }

  return true
}

// ── Auto-upgrade service functions ────────────────────────────────────────────

function defaultStrategySettingForCategory(category: PluginCategory): StrategySetting {
  return category === 'model' ? 'latest' : 'fix_only'
}

function defaultUpgradeTimeOfDay(tenantId: string): number {
  const hash = createHash('sha256').update(tenantId).digest()
  const slot = Number(BigInt(hash.readUInt32BE(0)) % BigInt(AUTO_UPGRADE_CHECK_SLOT_COUNT))
  return slot * AUTO_UPGRADE_CHECK_SLOT_SECONDS
}

/**
 * Get auto-upgrade strategy for a category.
 * Mirrors Python `PluginAutoUpgradeService.get_strategy`.
 */
export async function getAutoUpgradeStrategy(
  db: Database,
  tenantId: string,
  category: PluginCategory,
): Promise<AutoUpgradeFetchResponse> {
  const [row] = await db
    .select({
      strategySetting: tenantPluginAutoUpgradeStrategies.strategySetting,
      upgradeTimeOfDay: tenantPluginAutoUpgradeStrategies.upgradeTimeOfDay,
      upgradeMode: tenantPluginAutoUpgradeStrategies.upgradeMode,
      excludePlugins: tenantPluginAutoUpgradeStrategies.excludePlugins,
      includePlugins: tenantPluginAutoUpgradeStrategies.includePlugins,
    })
    .from(tenantPluginAutoUpgradeStrategies)
    .where(
      and(
        eq(tenantPluginAutoUpgradeStrategies.tenantId, tenantId),
        eq(tenantPluginAutoUpgradeStrategies.category, category),
      ),
    )
    .limit(1)

  if (!row) {
    return {
      category,
      autoUpgrade: {
        strategySetting: defaultStrategySettingForCategory(category),
        upgradeTimeOfDay: defaultUpgradeTimeOfDay(tenantId),
        upgradeMode: 'exclude',
        excludePlugins: [],
        includePlugins: [],
      },
    }
  }

  return {
    category,
    autoUpgrade: {
      strategySetting: row.strategySetting as StrategySetting,
      upgradeTimeOfDay: row.upgradeTimeOfDay,
      upgradeMode: row.upgradeMode as UpgradeMode,
      excludePlugins: row.excludePlugins,
      includePlugins: row.includePlugins,
    },
  }
}

/**
 * Change auto-upgrade strategy for a category.
 * Mirrors Python `PluginAutoUpgradeService.change_strategy`.
 */
export async function changeAutoUpgradeStrategy(
  db: Database,
  tenantId: string,
  category: PluginCategory,
  strategySetting: StrategySetting,
  upgradeTimeOfDay: number,
  upgradeMode: UpgradeMode,
  excludePlugins: string[],
  includePlugins: string[],
): Promise<boolean> {
  const [existing] = await db
    .select({ id: tenantPluginAutoUpgradeStrategies.id })
    .from(tenantPluginAutoUpgradeStrategies)
    .where(
      and(
        eq(tenantPluginAutoUpgradeStrategies.tenantId, tenantId),
        eq(tenantPluginAutoUpgradeStrategies.category, category),
      ),
    )
    .limit(1)

  if (!existing) {
    await db.insert(tenantPluginAutoUpgradeStrategies).values({
      id: uuidv4(),
      tenantId,
      category,
      strategySetting,
      upgradeTimeOfDay,
      upgradeMode,
      excludePlugins,
      includePlugins,
    })
  }
  else {
    await db
      .update(tenantPluginAutoUpgradeStrategies)
      .set({
        strategySetting,
        upgradeTimeOfDay,
        upgradeMode,
        excludePlugins,
        includePlugins,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantPluginAutoUpgradeStrategies.tenantId, tenantId),
          eq(tenantPluginAutoUpgradeStrategies.category, category),
        ),
      )
  }

  return true
}

/**
 * Exclude a plugin from automatic updates.
 * Mirrors Python `PluginAutoUpgradeService.exclude_plugin`.
 */
export async function excludePluginFromAutoUpgrade(
  db: Database,
  tenantId: string,
  pluginId: string,
  category: PluginCategory,
): Promise<boolean> {
  const [existing] = await db
    .select({
      id: tenantPluginAutoUpgradeStrategies.id,
      upgradeMode: tenantPluginAutoUpgradeStrategies.upgradeMode,
      excludePlugins: tenantPluginAutoUpgradeStrategies.excludePlugins,
      includePlugins: tenantPluginAutoUpgradeStrategies.includePlugins,
    })
    .from(tenantPluginAutoUpgradeStrategies)
    .where(
      and(
        eq(tenantPluginAutoUpgradeStrategies.tenantId, tenantId),
        eq(tenantPluginAutoUpgradeStrategies.category, category),
      ),
    )
    .limit(1)

  if (!existing) {
    // Create new strategy with this plugin excluded
    await db.insert(tenantPluginAutoUpgradeStrategies).values({
      id: uuidv4(),
      tenantId,
      category,
      strategySetting: 'fix_only',
      upgradeTimeOfDay: 0,
      upgradeMode: 'exclude',
      excludePlugins: [pluginId],
      includePlugins: [],
    })
  }
  else {
    const mode = existing.upgradeMode as UpgradeMode
    let newExcludePlugins = [...existing.excludePlugins]
    let newIncludePlugins = [...existing.includePlugins]
    let newMode = mode

    if (mode === 'exclude') {
      if (!newExcludePlugins.includes(pluginId)) {
        newExcludePlugins.push(pluginId)
      }
    }
    else if (mode === 'partial') {
      newIncludePlugins = newIncludePlugins.filter((id) => id !== pluginId)
    }
    else if (mode === 'all') {
      newMode = 'exclude'
      newExcludePlugins = [pluginId]
    }

    await db
      .update(tenantPluginAutoUpgradeStrategies)
      .set({
        upgradeMode: newMode,
        excludePlugins: newExcludePlugins,
        includePlugins: newIncludePlugins,
        updatedAt: new Date(),
      })
      .where(eq(tenantPluginAutoUpgradeStrategies.id, existing.id))
  }

  return true
}

// ── Plugin list service functions ─────────────────────────────────────────────

interface PluginEntity {
  plugin_id: string
  plugin_unique_identifier: string
  declaration: Record<string, unknown>
  endpoints_setups: number
  endpoints_active: number
  [key: string]: unknown
}

interface PluginListResult {
  plugins: PluginEntity[]
  total: number
}

interface PluginCategoryListResult {
  plugins: PluginEntity[]
  has_more: boolean
}

function normalizeEndpointCount(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return Math.max(0, value)
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isNaN(n) ? 0 : Math.max(0, n)
  }
  return 0
}

/**
 * List plugins with total count (paginated).
 * Mirrors Python `PluginService.list_with_total`.
 */
export async function listPlugins(
  tenantId: string,
  userId: string,
  page: number,
  pageSize: number,
): Promise<PluginListResult> {
  const result = await requestPluginDaemon<{
    list: PluginEntity[]
    total: number
  }>(
    'GET',
    `plugin/${tenantId}/management/list`,
    { params: { page, page_size: pageSize, response_type: 'paged' } },
  )

  // Reconcile endpoint counts for plugins with endpoint declarations
  await reconcileEndpointCounts(tenantId, userId, result.list)

  return { plugins: result.list, total: result.total }
}

/**
 * List plugins by category.
 * Mirrors Python `PluginService.list_by_category`.
 */
export async function listPluginsByCategory(
  tenantId: string,
  category: PluginCategory,
  page: number,
  pageSize: number,
): Promise<PluginCategoryListResult> {
  const result = await requestPluginDaemon<{
    list: PluginEntity[]
    has_more: boolean
  }>(
    'GET',
    `plugin/${tenantId}/management/${category}/list`,
    { params: { page, page_size: pageSize, response_type: 'paged' } },
  )

  return { plugins: result.list, has_more: result.has_more }
}

async function reconcileEndpointCounts(
  tenantId: string,
  userId: string,
  plugins: PluginEntity[],
): Promise<void> {
  for (const plugin of plugins) {
    plugin.endpoints_setups = normalizeEndpointCount(plugin.endpoints_setups)
    plugin.endpoints_active = normalizeEndpointCount(plugin.endpoints_active)

    const declaration = plugin.declaration as { endpoint?: unknown } | null
    if (!declaration?.endpoint) continue

    let setups = 0
    let active = 0
    let pageNum = 1

    try {
      while (true) {
        const endpoints = await requestPluginDaemon<Array<{ enabled: boolean }>>(
          'GET',
          `plugin/${tenantId}/endpoint/list/plugin`,
          {
            params: {
              plugin_id: plugin.plugin_id,
              page: pageNum,
              page_size: ENDPOINT_RECONCILIATION_PAGE_SIZE,
            },
          },
        )

        setups += endpoints.length
        active += endpoints.filter((ep) => ep.enabled).length

        if (endpoints.length < ENDPOINT_RECONCILIATION_PAGE_SIZE) break
        pageNum++
      }

      plugin.endpoints_setups = setups
      plugin.endpoints_active = active
    }
    catch {
      // Non-fatal: keep daemon-provided counts
    }
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────

export function isValidCategory(value: string): value is PluginCategory {
  return VALID_CATEGORIES.has(value)
}

export function isValidStrategySetting(value: string): value is StrategySetting {
  return VALID_STRATEGY_SETTINGS.has(value)
}

export function isValidUpgradeMode(value: string): value is UpgradeMode {
  return VALID_UPGRADE_MODES.has(value)
}

export function isAdminOrOwner(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role)
}
