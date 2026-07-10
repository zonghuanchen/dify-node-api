/**
 * Installed Apps service — mirrors Python api/controllers/console/explore/installed_app.py.
 *
 * Provides list/install/uninstall/update operations for installed apps.
 * Enterprise webapp_auth filtering is stubbed (non-enterprise deployments only).
 */

import { and, eq, exists, inArray, isNotNull, ne, or, sql } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { appModelConfigs, apps, installedApps, recommendedApps, workflows } from '../db/schema.js'
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.js'

// ── App modes ──────────────────────────────────────────────────────
// Mirrors Python AppMode enum in api/models/model.py
const WORKFLOW_APP_MODES = ['advanced-chat', 'workflow'] as const
const AGENT_MODE = 'agent'

// ── Response types ─────────────────────────────────────────────────

export interface InstalledAppInfoResponse {
  id: string
  name: string | null
  description: string | null
  mode: string | null
  icon_type: string | null
  icon: string | null
  icon_background: string | null
  use_icon_as_answer_icon: boolean | null
  icon_url: string | null
}

export interface InstalledAppResponse {
  id: string
  app: InstalledAppInfoResponse
  app_owner_tenant_id: string
  is_pinned: boolean
  last_used_at: number | null
  editable: boolean
  uninstallable: boolean
}

export interface InstalledAppListResponse {
  installed_apps: InstalledAppResponse[]
}

// ── Helpers ────────────────────────────────────────────────────────

function toTimestamp(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor(date.getTime() / 1000)
}

/**
 * Build icon URL for image-type icons.
 * Mirrors Python _build_icon_url() in installed_app.py.
 * NOTE: In production, this should use file_helpers.get_signed_file_url().
 * For now, returns null — override with a proper implementation when file storage is available.
 */
function buildIconUrl(_iconType: string | null, _icon: string | null): string | null {
  // Stub: file storage signed URL generation is not yet implemented in api-node.
  // Python: file_helpers.get_signed_file_url(icon) when icon_type == 'image'
  return null
}

function buildAppInfo(app: typeof apps.$inferSelect): InstalledAppInfoResponse {
  return {
    id: app.id,
    name: app.name ?? null,
    description: app.description ?? null,
    mode: app.mode ?? null,
    icon_type: app.iconType ?? null,
    icon: app.icon ?? null,
    icon_background: app.iconBackground ?? null,
    use_icon_as_answer_icon: app.useIconAsAnswerIcon ?? false,
    icon_url: buildIconUrl(app.iconType ?? null, app.icon ?? null),
  }
}

// ── Service ────────────────────────────────────────────────────────

export const installedAppsService = {
  /**
   * List installed apps for the current tenant.
   *
   * Mirrors Python InstalledAppsListApi.get():
   * 1. JOIN installed_apps with apps
   * 2. Filter by tenant_id and published-app availability
   * 3. Attach editable/uninstallable flags based on role
   * 4. Sort: pinned first, then by last_used_at desc
   */
  async listInstalledApps(
    db: Database,
    tenantId: string,
    tenantRole: string,
    appIdFilter?: string,
  ): Promise<InstalledAppListResponse> {
    // Sub-query: does a published workflow exist for this app?
    const hasPublishedWorkflow = exists(
      db.select({ id: workflows.id }).from(workflows).where(eq(workflows.id, apps.workflowId)),
    )
    // Sub-query: does a published app_model_config exist for this app?
    const hasPublishedModelConfig = exists(
      db.select({ id: appModelConfigs.id }).from(appModelConfigs).where(eq(appModelConfigs.id, apps.appModelConfigId)),
    )

    // Published-app filter predicate — mirrors Python _published_app_filter()
    const publishedAppFilter = and(
      ne(apps.mode, AGENT_MODE),
      or(
        and(
          inArray(apps.mode, WORKFLOW_APP_MODES),
          isNotNull(apps.workflowId),
          hasPublishedWorkflow,
        ),
        and(
          sql`${apps.mode} NOT IN (${WORKFLOW_APP_MODES.map(m => `'${m}'`).join(', ')})`,
          isNotNull(apps.appModelConfigId),
          hasPublishedModelConfig,
        ),
      ),
    )

    const conditions = [
      eq(installedApps.tenantId, tenantId),
      publishedAppFilter,
    ]

    if (appIdFilter) {
      conditions.push(eq(installedApps.appId, appIdFilter))
    }

    const rows = await db
      .select({
        installedApp: installedApps,
        app: apps,
      })
      .from(installedApps)
      .innerJoin(apps, eq(apps.id, installedApps.appId))
      .where(and(...conditions))

    const editable = tenantRole === 'owner' || tenantRole === 'admin'

    const resultList: InstalledAppResponse[] = rows.map((row) => {
      return {
        id: row.installedApp.id,
        app: buildAppInfo(row.app),
        app_owner_tenant_id: row.installedApp.appOwnerTenantId,
        is_pinned: row.installedApp.isPinned,
        last_used_at: toTimestamp(row.installedApp.lastUsedAt),
        editable,
        uninstallable: tenantId === row.installedApp.appOwnerTenantId,
      }
    })

    // Sort: pinned first, then by last_used_at desc (nulls last)
    resultList.sort((a, b) => {
      // Pinned first (descending)
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      // Has last_used_at first
      const aNull = a.last_used_at === null
      const bNull = b.last_used_at === null
      if (aNull !== bNull) return aNull ? 1 : -1
      // Descending timestamp
      return (b.last_used_at ?? 0) - (a.last_used_at ?? 0)
    })

    return { installed_apps: resultList }
  },

  /**
   * Install an app for the current tenant.
   *
   * Mirrors Python InstalledAppsListApi.post():
   * 1. Verify recommended_app exists
   * 2. Verify app exists and is_public
   * 3. Check unique constraint (tenant + app_id)
   * 4. Create installed_app record and bump install_count
   */
  async installApp(
    db: Database,
    tenantId: string,
    appId: string,
  ): Promise<{ message: string }> {
    // 1. Verify recommended_app exists
    const [recApp] = await db
      .select()
      .from(recommendedApps)
      .where(eq(recommendedApps.appId, appId))
      .limit(1)

    if (!recApp) {
      throw new NotFoundError('Recommended app not found')
    }

    // 2. Verify app exists and is_public
    const [app] = await db
      .select()
      .from(apps)
      .where(eq(apps.id, appId))
      .limit(1)

    if (!app) {
      throw new NotFoundError('App entity not found')
    }

    if (!app.isPublic) {
      throw new ForbiddenError("You can't install a non-public app")
    }

    // 3. Check if already installed
    const [existing] = await db
      .select()
      .from(installedApps)
      .where(
        and(
          eq(installedApps.appId, appId),
          eq(installedApps.tenantId, tenantId),
        ),
      )
      .limit(1)

    if (existing) {
      return { message: 'App installed successfully' }
    }

    // 4. Bump install_count and create record
    await db
      .update(recommendedApps)
      .set({ installCount: recApp.installCount + 1 })
      .where(eq(recommendedApps.appId, appId))

    await db.insert(installedApps).values({
      id: crypto.randomUUID(),
      appId,
      tenantId,
      appOwnerTenantId: app.tenantId,
      isPinned: false,
      lastUsedAt: new Date(),
    })

    return { message: 'App installed successfully' }
  },

  /**
   * Uninstall an app.
   *
   * Mirrors Python InstalledAppApi.delete():
   * - Cannot uninstall if app is owned by the current tenant
   */
  async uninstallApp(
    db: Database,
    installedAppId: string,
    tenantId: string,
  ): Promise<void> {
    // Load the installed app (pre-validated by middleware, but double-check tenant)
    const [record] = await db
      .select()
      .from(installedApps)
      .where(
        and(
          eq(installedApps.id, installedAppId),
          eq(installedApps.tenantId, tenantId),
        ),
      )
      .limit(1)

    if (!record) {
      throw new NotFoundError('Installed app not found')
    }

    if (record.appOwnerTenantId === tenantId) {
      throw new BadRequestError("You can't uninstall an app owned by the current tenant")
    }

    await db.delete(installedApps).where(eq(installedApps.id, installedAppId))
  },

  /**
   * Update an installed app (currently only is_pinned).
   *
   * Mirrors Python InstalledAppApi.patch().
   */
  async updateInstalledApp(
    db: Database,
    installedAppId: string,
    tenantId: string,
    updates: { isPinned?: boolean },
  ): Promise<{ result: string; message: string }> {
    // Verify ownership
    const [record] = await db
      .select()
      .from(installedApps)
      .where(
        and(
          eq(installedApps.id, installedAppId),
          eq(installedApps.tenantId, tenantId),
        ),
      )
      .limit(1)

    if (!record) {
      throw new NotFoundError('Installed app not found')
    }

    if (updates.isPinned !== undefined) {
      await db
        .update(installedApps)
        .set({ isPinned: updates.isPinned })
        .where(eq(installedApps.id, installedAppId))
    }

    return { result: 'success', message: 'App info updated successfully' }
  },
}
