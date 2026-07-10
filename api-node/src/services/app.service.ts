/**
 * App service — mirrors Python api/services/app_service.py.
 *
 * Provides paginated app listing with filters, sorting, and star markers.
 */

import { and, asc, count, desc, eq, ilike, inArray, type SQL } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { appStars, apps } from '../db/schema.js'

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

// ── Helpers ──────────────────────────────────────────────────────

function toTimestamp(date: Date | null | undefined): number {
  if (!date) return 0
  return Math.floor(date.getTime() / 1000)
}

/** Escape special LIKE characters in user input. */
function escapeLike(s: string): string {
  return s.replace(/[%\\_]/g, '\\$&')
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

    const total = totalRow?.count ?? 0

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
}
