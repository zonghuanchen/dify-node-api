/**
 * App service — mirrors Python api/services/app_service.py.
 *
 * Provides paginated app listing with filters, sorting, and star markers.
 */

import { and, asc, count, desc, eq, ilike, inArray, type SQL } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { appModelConfigs, apps, appStars, sites, tagBindings, tags, workflows } from '../db/schema.js'


// ── Types ────────────────────────────────────────────────────────

export type AppListMode = 'chat' | 'agent-chat' | 'agent' | 'advanced-chat' | 'workflow' | 'completion' | 'all'
export type AppListSortBy = 'last_modified' | 'recently_created' | 'earliest_created'

export interface AppListParams {
  page: number
  limit: number
  mode?: string
  sortBy: AppListSortBy
  name?: string
  creatorIds?: string[]
  isCreatedByMe?: boolean
}

export interface AppListItem {
  id: string
  name: string
  description: string
  mode: string
  icon_type: string | null
  icon: string | null
  icon_background: string | null
  icon_url: string | null
  use_icon_as_answer_icon: boolean
  status: string
  enable_site: boolean
  enable_api: boolean
  is_demo: boolean
  is_public: boolean
  created_by: string | null
  created_at: number
  updated_at: number
  is_starred: boolean
}

export interface AppPaginationResponse {
  page: number
  limit: number
  total: number
  has_more: boolean
  data: AppListItem[]
}

// ── App Detail Types ──────────────────────────────────────────────

export interface AppDetailSiteResponse {
  access_token: string | null
  code: string | null
  title: string | null
  icon_type: string | null
  icon: string | null
  icon_background: string | null
  icon_url: string | null
  description: string | null
  default_language: string | null
  chat_color_theme: string | null
  chat_color_theme_inverted: boolean | null
  customize_domain: string | null
  copyright: string | null
  privacy_policy: string | null
  input_placeholder: string | null
  custom_disclaimer: string | null
  customize_token_strategy: string | null
  prompt_public: boolean | null
  app_base_url: string | null
  show_workflow_steps: boolean | null
  use_icon_as_answer_icon: boolean | null
  created_by: string | null
  created_at: number | null
  updated_by: string | null
  updated_at: number | null
}

export interface AppDetailWorkflowPartial {
  id: string
  created_by: string | null
  created_at: number | null
  updated_by: string | null
  updated_at: number | null
}

export interface AppDetailModelConfigPartial {
  model: unknown
  pre_prompt: string | null
  created_by: string | null
  created_at: number | null
  updated_by: string | null
  updated_at: number | null
}

export interface AppDetailTag {
  id: string
  name: string
  type: string
}

export interface AppDetailResponse {
  id: string
  name: string
  description: string | null
  mode: string
  icon: string | null
  icon_type: string | null
  icon_background: string | null
  icon_url: string | null
  enable_site: boolean
  enable_api: boolean
  model_config: AppDetailModelConfigPartial | null
  workflow: AppDetailWorkflowPartial | null
  tracing: unknown
  use_icon_as_answer_icon: boolean
  max_active_requests: number | null
  created_by: string | null
  created_at: number
  updated_by: string | null
  updated_at: number
  access_mode: string | null
  tags: AppDetailTag[]
  permission_keys: string[]
  maintainer: string | null
  site: AppDetailSiteResponse | null
  deleted_tools: unknown[]
  bound_agent_id: string | null
  app_id: string | null
}

// ── Helpers ──────────────────────────────────────────────────────

function toTimestamp(date: Date | null | undefined): number {
  if (!date) return 0
  return Math.floor(date.getTime() / 1000)
}

/** Escape special LIKE characters in user input. */
function escapeLike(s: string): string {
  return s.replace(/[%\\_]/g, '\\$&')
}

/**
 * Build icon URL — mirrors Python `build_icon_url()` from api/libs/helper.py.
 * Returns null when icon_type is not 'image' or icon is null.
 */
function buildIconUrl(iconType: string | null | undefined, icon: string | null | undefined): string | null {
  if (!icon || !iconType) return null
  if (String(iconType).toLowerCase() !== 'image') return null
  // In Python this calls file_helpers.get_signed_file_url(icon).
  // For now, return the icon value directly (file ID); expand when file-service is available.
  return icon
}

/** Safely parse a JSON string, returning the raw string on failure. */
function tryParseJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return raw }
}

// ── Service ──────────────────────────────────────────────────────

export const appService = {
  /**
   * Get paginated apps with filters and sort order.
   * Mirrors Python `AppService.get_paginate_apps()`.
   */
  async getPaginateApps(
    db: Database,
    userId: string,
    tenantId: string,
    params: AppListParams,
  ): Promise<AppPaginationResponse> {
    // 1. Build filter conditions
    const conditions: SQL[] = [
      eq(apps.tenantId, tenantId),
      eq(apps.isUniversal, false),
      eq(apps.status, 'normal'),
    ]

    // Mode filter
    if (params.mode && params.mode !== 'all') {
      if (params.mode === 'agent') {
        conditions.push(eq(apps.mode, 'agent'))
      }
      else {
        conditions.push(eq(apps.mode, params.mode))
      }
    }
    else if (params.mode === 'all') {
      // 'all' excludes agent apps (Python convention)
      const { ne } = await import('drizzle-orm')
      conditions.push(ne(apps.mode, 'agent'))
    }

    // Created by me
    if (params.isCreatedByMe) {
      conditions.push(eq(apps.createdBy, userId))
    }

    // Creator IDs filter
    if (params.creatorIds && params.creatorIds.length > 0) {
      conditions.push(inArray(apps.createdBy, params.creatorIds))
    }

    // Name search (ILIKE, max 30 chars)
    if (params.name) {
      const namePattern = `%${escapeLike(params.name.slice(0, 30))}%`
      conditions.push(ilike(apps.name, namePattern))
    }

    const whereClause = and(...conditions)

    // 2. Count total
    const [totalRow] = await db
      .select({ count: count() })
      .from(apps)
      .where(whereClause)

    const total = totalRow?.count ? Number(totalRow.count) : 0

    // 3. Determine sort order
    let orderBy: SQL
    switch (params.sortBy) {
      case 'recently_created':
        orderBy = desc(apps.createdAt)
        break
      case 'earliest_created':
        orderBy = asc(apps.createdAt)
        break
      case 'last_modified':
      default:
        orderBy = desc(apps.updatedAt)
        break
    }

    // 4. Fetch page
    const offset = (params.page - 1) * params.limit
    const rows = await db
      .select()
      .from(apps)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(offset)

    if (!rows || rows.length === 0) {
      return {
        page: params.page,
        limit: params.limit,
        total,
        has_more: false,
        data: [],
      }
    }

    // 5. Check starred status
    const appIds = rows.map((r) => r.id)
    let starredSet = new Set<string>()
    if (appIds.length > 0) {
      const starredRows = await db
        .select({ appId: appStars.appId })
        .from(appStars)
        .where(
          and(
            eq(appStars.tenantId, tenantId),
            eq(appStars.accountId, userId),
            inArray(appStars.appId, appIds),
          ),
        )
      starredSet = new Set(starredRows.map((r) => r.appId))
    }

    // 6. Build response
    const data: AppListItem[] = rows.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      mode: app.mode,
      icon_type: app.iconType,
      icon: app.icon,
      icon_background: app.iconBackground,
      icon_url: null,
      use_icon_as_answer_icon: app.useIconAsAnswerIcon,
      status: app.status,
      enable_site: app.enableSite,
      enable_api: app.enableApi,
      is_demo: app.isDemo,
      is_public: app.isPublic,
      created_by: app.createdBy,
      created_at: toTimestamp(app.createdAt),
      updated_at: toTimestamp(app.updatedAt),
      is_starred: starredSet.has(app.id),
    }))

    return {
      page: params.page,
      limit: params.limit,
      total,
      has_more: offset + rows.length < total,
      data,
    }
  },

  /**
   * Get paginated starred apps with filters and sort order.
   * Mirrors Python `AppService.get_paginate_starred_apps()` from app_service.py L255.
   *
   * Same as getPaginateApps but INNER JOINs app_stars to only return apps
   * starred by the current user. All returned apps have is_starred = true.
   */
  async getPaginateStarredApps(
    db: Database,
    userId: string,
    tenantId: string,
    params: AppListParams,
  ): Promise<AppPaginationResponse> {
    // 1. Build filter conditions (same as getPaginateApps)
    const conditions: SQL[] = [
      eq(apps.tenantId, tenantId),
      eq(apps.isUniversal, false),
      eq(apps.status, 'normal'),
    ]

    // Mode filter
    if (params.mode && params.mode !== 'all') {
      if (params.mode === 'agent') {
        conditions.push(eq(apps.mode, 'agent'))
      }
      else {
        conditions.push(eq(apps.mode, params.mode))
      }
    }
    else if (params.mode === 'all' || !params.mode) {
      const { ne } = await import('drizzle-orm')
      conditions.push(ne(apps.mode, 'agent'))
    }

    // Created by me
    if (params.isCreatedByMe) {
      conditions.push(eq(apps.createdBy, userId))
    }

    // Creator IDs filter
    if (params.creatorIds && params.creatorIds.length > 0) {
      conditions.push(inArray(apps.createdBy, params.creatorIds))
    }

    // Name search (ILIKE, max 30 chars)
    if (params.name) {
      const namePattern = `%${escapeLike(params.name.slice(0, 30))}%`
      conditions.push(ilike(apps.name, namePattern))
    }

    const whereClause = and(...conditions)

    // 2. Count total starred apps matching filters
    const countBase = db
      .select({ count: count() })
      .from(apps)
      .innerJoin(appStars, and(
        eq(appStars.tenantId, apps.tenantId),
        eq(appStars.appId, apps.id),
        eq(appStars.accountId, userId),
      ))
      .where(and(eq(appStars.tenantId, tenantId), whereClause))

    const [totalRow] = await countBase
    const total = totalRow?.count ? Number(totalRow.count) : 0

    // 3. Determine sort order
    let orderBy: SQL
    switch (params.sortBy) {
      case 'recently_created':
        orderBy = desc(apps.createdAt)
        break
      case 'earliest_created':
        orderBy = asc(apps.createdAt)
        break
      case 'last_modified':
      default:
        orderBy = desc(apps.updatedAt)
        break
    }

    // 4. Fetch page with INNER JOIN on app_stars
    const offset = (params.page - 1) * params.limit
    const rows = await db
      .select({
        id: apps.id,
        name: apps.name,
        description: apps.description,
        mode: apps.mode,
        iconType: apps.iconType,
        icon: apps.icon,
        iconBackground: apps.iconBackground,
        useIconAsAnswerIcon: apps.useIconAsAnswerIcon,
        status: apps.status,
        enableSite: apps.enableSite,
        enableApi: apps.enableApi,
        isDemo: apps.isDemo,
        isPublic: apps.isPublic,
        createdBy: apps.createdBy,
        createdAt: apps.createdAt,
        updatedAt: apps.updatedAt,
      })
      .from(apps)
      .innerJoin(appStars, and(
        eq(appStars.tenantId, apps.tenantId),
        eq(appStars.appId, apps.id),
        eq(appStars.accountId, userId),
      ))
      .where(and(eq(appStars.tenantId, tenantId), whereClause))
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(offset)

    if (!rows || rows.length === 0) {
      return {
        page: params.page,
        limit: params.limit,
        total,
        has_more: false,
        data: [],
      }
    }

    // 5. Build response — all items are starred (filtered by JOIN)
    const data: AppListItem[] = rows.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      mode: app.mode,
      icon_type: app.iconType,
      icon: app.icon,
      icon_background: app.iconBackground,
      icon_url: null,
      use_icon_as_answer_icon: app.useIconAsAnswerIcon,
      status: app.status,
      enable_site: app.enableSite,
      enable_api: app.enableApi,
      is_demo: app.isDemo,
      is_public: app.isPublic,
      created_by: app.createdBy,
      created_at: toTimestamp(app.createdAt),
      updated_at: toTimestamp(app.updatedAt),
      is_starred: true,
    }))

    return {
      page: params.page,
      limit: params.limit,
      total,
      has_more: offset + rows.length < total,
      data,
    }
  },

  /**
   * Get a single app by ID with full detail (site, workflow, tags, starred).
   * Mirrors Python `AppApi.get` from controllers/console/app/app.py L728.
   */
  async getAppById(
    db: Database,
    userId: string,
    tenantId: string,
    appId: string,
  ): Promise<AppDetailResponse | null> {
    // 1. Fetch app row (must belong to tenant, status=normal)
    const [app] = await db
      .select()
      .from(apps)
      .where(and(eq(apps.id, appId), eq(apps.tenantId, tenantId)))

    if (!app) return null

    // 2. Fetch site (LEFT JOIN equivalent — one query)
    const [siteRow] = await db
      .select()
      .from(sites)
      .where(eq(sites.appId, appId))

    const site: AppDetailSiteResponse | null = siteRow
      ? {
          access_token: siteRow.code,
          code: siteRow.code,
          title: siteRow.title,
          icon_type: siteRow.iconType,
          icon: siteRow.icon,
          icon_background: siteRow.iconBackground,
          icon_url: buildIconUrl(siteRow.iconType, siteRow.icon),
          description: siteRow.description,
          default_language: siteRow.defaultLanguage,
          chat_color_theme: siteRow.chatColorTheme,
          chat_color_theme_inverted: siteRow.chatColorThemeInverted,
          customize_domain: siteRow.customizeDomain,
          copyright: siteRow.copyright,
          privacy_policy: siteRow.privacyPolicy,
          input_placeholder: siteRow.inputPlaceholder,
          custom_disclaimer: siteRow.customDisclaimer,
          customize_token_strategy: siteRow.customizeTokenStrategy,
          prompt_public: siteRow.promptPublic,
          app_base_url: null,
          show_workflow_steps: siteRow.showWorkflowSteps,
          use_icon_as_answer_icon: siteRow.useIconAsAnswerIcon,
          created_by: siteRow.createdBy,
          created_at: toTimestamp(siteRow.createdAt) || null,
          updated_by: siteRow.updatedBy,
          updated_at: toTimestamp(siteRow.updatedAt) || null,
        }
      : null

    // 3. Fetch workflow partial (if app has workflowId)
    let workflowPartial: AppDetailWorkflowPartial | null = null
    if (app.workflowId) {
      const [wf] = await db
        .select({
          id: workflows.id,
          createdBy: workflows.createdBy,
          createdAt: workflows.createdAt,
          updatedBy: workflows.updatedBy,
          updatedAt: workflows.updatedAt,
        })
        .from(workflows)
        .where(eq(workflows.id, app.workflowId))
      if (wf) {
        workflowPartial = {
          id: wf.id,
          created_by: wf.createdBy,
          created_at: toTimestamp(wf.createdAt) || null,
          updated_by: wf.updatedBy,
          updated_at: toTimestamp(wf.updatedAt) || null,
        }
      }
    }

    // 4. Fetch model_config partial (if app has appModelConfigId)
    let modelConfigPartial: AppDetailModelConfigPartial | null = null
    if (app.appModelConfigId) {
      const [mc] = await db
        .select({
          id: appModelConfigs.id,
          createdBy: appModelConfigs.appId, // schema only has id, appId, createdAt
          createdAt: appModelConfigs.createdAt,
        })
        .from(appModelConfigs)
        .where(eq(appModelConfigs.id, app.appModelConfigId))
      if (mc) {
        modelConfigPartial = {
          model: null,
          pre_prompt: null,
          created_by: null,
          created_at: toTimestamp(mc.createdAt) || null,
          updated_by: null,
          updated_at: null,
        }
      }
    }

    // 5. Fetch tags for this app (via tag_bindings)
    const tagRows = await db
      .select({
        id: tags.id,
        name: tags.name,
        type: tags.type,
      })
      .from(tagBindings)
      .innerJoin(tags, eq(tags.id, tagBindings.tagId))
      .where(and(eq(tagBindings.targetId, appId), eq(tagBindings.tenantId, tenantId)))

    const appTags: AppDetailTag[] = tagRows.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
    }))

    // 6. Build response
    return {
      id: app.id,
      name: app.name,
      description: app.description,
      mode: app.mode,
      icon: app.icon,
      icon_type: app.iconType,
      icon_background: app.iconBackground,
      icon_url: buildIconUrl(app.iconType, app.icon),
      enable_site: app.enableSite,
      enable_api: app.enableApi,
      model_config: modelConfigPartial,
      workflow: workflowPartial,
      tracing: app.tracing ? tryParseJson(app.tracing) : null,
      use_icon_as_answer_icon: app.useIconAsAnswerIcon,
      max_active_requests: app.maxActiveRequests,
      created_by: app.createdBy,
      created_at: toTimestamp(app.createdAt),
      updated_by: app.updatedBy,
      updated_at: toTimestamp(app.updatedAt),
      access_mode: null,
      tags: appTags,
      permission_keys: [],
      maintainer: app.maintainer,
      site,
      deleted_tools: [],
      bound_agent_id: null,
      app_id: null,
    }
  },
}
