/**
 * Explore apps route.
 * Mirrors Python api/controllers/console/explore/recommended_app.py.
 *
 * GET /console/api/explore/apps           — RecommendedAppListApi
 * GET /console/api/explore/apps/learn-dify — LearnDifyAppListApi
 *
 * Returns recommended apps (and optionally Learn Dify apps) for the explore page.
 */

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { requireAccountInitialized } from '../../../middleware/account-init.js'
import { requireAuth } from '../../../middleware/auth.js'
import { recommendedAppService } from '../../../services/recommended-app.service.js'
import type { AppEnv } from '../../../types/hono-env.js'
import { accounts } from '../../../db/schema.js'
import type { Database } from '../../../db/index.js'

// Valid languages supported by the explore page
const VALID_LANGUAGES = new Set([
  'en-US', 'zh-Hans', 'zh-Hant', 'ja-JP', 'ko-KR',
  'fr-FR', 'de-DE', 'es-ES', 'pt-BR', 'vi-VN',
])

/**
 * Resolve the effective display language.
 * Priority: query param → user's interface_language → 'en-US'.
 */
async function resolveLanguage(
  c: { req: { query: (key: string) => string | undefined } },
  db: Database,
  accountId: string,
): Promise<string> {
  let language = c.req.query('language')
  if (!language || !VALID_LANGUAGES.has(language)) {
    const [account] = await db
      .select({ interfaceLanguage: accounts.interfaceLanguage })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    language = account?.interfaceLanguage ?? 'en-US'
    if (!VALID_LANGUAGES.has(language)) {
      language = 'en-US'
    }
  }
  return language
}

export const exploreAppsRoute = new Hono<AppEnv>()

// ── GET /explore/apps/learn-dify ─────────────────────────────────
// Must be registered before /explore/apps to avoid route shadowing.
exploreAppsRoute.get(
  '/explore/apps/learn-dify',
  requireAuth,
  requireAccountInitialized,
  async (c) => {
    const accountId = c.get('accountId')!
    const db = c.get('db')

    const language = await resolveLanguage(c, db, accountId)
    const result = await recommendedAppService.getLearnDifyApps(db, language)
    return c.json(result)
  },
)

// ── GET /explore/apps ────────────────────────────────────────────
exploreAppsRoute.get(
  '/explore/apps',
  requireAuth,
  requireAccountInitialized,
  async (c) => {
    const accountId = c.get('accountId')!
    const db = c.get('db')

    const language = await resolveLanguage(c, db, accountId)
    const result = await recommendedAppService.getRecommendedAppsAndCategories(db, language)
    return c.json(result)
  },
)
