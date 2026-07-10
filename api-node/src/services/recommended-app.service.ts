/**
 * Recommended app service — mirrors Python api/services/recommended_app_service.py.
 *
 * Queries the recommended_apps table joined with apps and sites to return
 * recommended apps and their categories.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { apps, recommendedApps, sites, trialApps } from '../db/schema.js'
import { redis } from '../lib/redis.js'
import { getSystemFeatures } from './feature.service.js'

// ── Types ────────────────────────────────────────────────────────

export interface RecommendedAppInfo {
  id: string
  name: string | null
  mode: string | null
  icon: string | null
  icon_type: string | null
  icon_background: string | null
}

export interface RecommendedAppItem {
  app: RecommendedAppInfo | null
  app_id: string
  description: string | null
  copyright: string | null
  privacy_policy: string | null
  custom_disclaimer: string | null
  categories: string[]
  position: number | null
  is_listed: boolean | null
  can_trial: boolean | null
}

export interface RecommendedAppListResponse {
  recommended_apps: RecommendedAppItem[]
  categories: string[]
}

export interface LearnDifyAppListResponse {
  recommended_apps: RecommendedAppItem[]
}

// ── Service ──────────────────────────────────────────────────────

export const recommendedAppService = {
  /**
   * Get recommended apps and categories for the given language.
   * Falls back to 'en-US' if no results found for the requested language.
   */
  async getRecommendedAppsAndCategories(
    db: Database,
    language: string,
  ): Promise<RecommendedAppListResponse> {
    let result = await fetchRecommendedApps(db, language, { isLearnDify: false })

    // Fallback to en-US if no results
    if (result.recommended_apps.length === 0 && language !== 'en-US') {
      result = await fetchRecommendedApps(db, 'en-US', { isLearnDify: false })
    }

    // Check trial eligibility if enabled
    if (getSystemFeatures().enable_trial_app) {
      await enrichWithTrialInfo(db, result.recommended_apps)
    }

    return result
  },

  /**
   * Get Learn Dify apps for the given language.
   * Falls back to 'en-US' if no results found for the requested language.
   * Mirrors Python RecommendedAppService.get_learn_dify_apps.
   */
  async getLearnDifyApps(
    db: Database,
    language: string,
  ): Promise<LearnDifyAppListResponse> {
    let result = await fetchRecommendedApps(db, language, { isLearnDify: true })

    // Fallback to en-US if no results
    if (result.recommended_apps.length === 0 && language !== 'en-US') {
      result = await fetchRecommendedApps(db, 'en-US', { isLearnDify: true })
    }

    // Check trial eligibility if enabled
    if (getSystemFeatures().enable_trial_app) {
      await enrichWithTrialInfo(db, result.recommended_apps)
    }

    return { recommended_apps: result.recommended_apps }
  },
}

// ── Internal helpers ─────────────────────────────────────────────

const EXPLORE_APP_CATEGORY_ORDER_KEY_PREFIX = 'explore:apps:category_order'

/**
 * Order categories using Redis-backed ordering (mirrors Python category_order.py).
 * Falls back to alphabetical sort when Redis is unavailable or has no data.
 */
async function orderCategories(categories: string[], language: string): Promise<string[]> {
  try {
    const raw = await redis.get(`${EXPLORE_APP_CATEGORY_ORDER_KEY_PREFIX}:${language}`)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((c): c is string => typeof c === 'string')) {
        return parsed
      }
    }
  }
  catch {
    // Redis unavailable or invalid payload — fall through to alphabetical sort
  }
  return [...categories].sort()
}

async function fetchRecommendedApps(
  db: Database,
  language: string,
  opts: { isLearnDify: boolean },
): Promise<RecommendedAppListResponse> {
  // Build WHERE conditions — always filter by isListed + language
  const conditions = [
    eq(recommendedApps.isListed, true),
    eq(recommendedApps.language, language),
  ]

  // When fetching Learn Dify apps, add the isLearnDify filter
  if (opts.isLearnDify) {
    conditions.push(eq(recommendedApps.isLearnDify, true))
  }

  // Query recommended_apps joined with apps AND sites (mirrors Python _format_recommended_apps)
  const rows = await db
    .select({
      // recommended_apps fields
      recAppId: recommendedApps.id,
      appId: recommendedApps.appId,
      categories: recommendedApps.categories,
      position: recommendedApps.position,
      isListed: recommendedApps.isListed,
      // apps fields
      appName: apps.name,
      appMode: apps.mode,
      appIcon: apps.icon,
      appIconType: apps.iconType,
      appIconBackground: apps.iconBackground,
      appIsPublic: apps.isPublic,
      // sites fields — description/copyright/privacy_policy/custom_disclaimer come from here
      siteDescription: sites.description,
      siteCopyright: sites.copyright,
      sitePrivacyPolicy: sites.privacyPolicy,
      siteCustomDisclaimer: sites.customDisclaimer,
    })
    .from(recommendedApps)
    .leftJoin(apps, eq(recommendedApps.appId, apps.id))
    .leftJoin(sites, eq(recommendedApps.appId, sites.appId))
    .where(and(...conditions))
    .orderBy(recommendedApps.position)

  // Collect unique categories
  const categorySet = new Set<string>()
  const recommended_apps: RecommendedAppItem[] = []

  for (const row of rows) {
    // Mirror Python: skip apps that are not public or have no associated app row
    if (!row.appName || !row.appIsPublic) {
      continue
    }

    // Mirror Python: skip apps without a site record
    if (row.siteDescription === null && row.siteCopyright === null && row.sitePrivacyPolicy === null) {
      // Heuristic: no site row matched (all site fields are null from LEFT JOIN)
      continue
    }

    // Merge categories from JSON field
    const cats = Array.isArray(row.categories) ? row.categories as string[] : []
    for (const cat of cats) {
      categorySet.add(cat)
    }

    recommended_apps.push({
      app: {
        id: row.appId,
        name: row.appName,
        mode: row.appMode,
        icon: row.appIcon,
        icon_type: row.appIconType,
        icon_background: row.appIconBackground,
      },
      app_id: row.appId,
      // Use site fields (mirrors Python database_retrieval.py)
      description: row.siteDescription ?? null,
      copyright: row.siteCopyright ?? null,
      privacy_policy: row.sitePrivacyPolicy ?? null,
      custom_disclaimer: row.siteCustomDisclaimer ?? null,
      categories: cats,
      position: row.position,
      is_listed: row.isListed,
      can_trial: null,
    })
  }

  const categories = await orderCategories([...categorySet], language)

  return {
    recommended_apps,
    categories,
  }
}

/**
 * Enrich recommended apps with trial eligibility info.
 * Sets can_trial = true if the app exists in the trial_apps table.
 */
async function enrichWithTrialInfo(
  db: Database,
  items: RecommendedAppItem[],
): Promise<void> {
  if (items.length === 0) return

  const appIds = items.map((i) => i.app_id)
  const trialRows = await db
    .select({ appId: trialApps.appId })
    .from(trialApps)
    .where(inArray(trialApps.appId, appIds))

  const trialSet = new Set(trialRows.map((r) => r.appId))

  for (const item of items) {
    item.can_trial = trialSet.has(item.app_id)
  }
}
