/**
 * Developer API service — implements the enterprise developerApiSettings contract
 * for self-hosted deployments. There is no open-source Python implementation to mirror;
 * this service builds the response from the @dify/contracts type definitions using the
 * existing api_tokens and apps tables.
 */

import { and, eq } from 'drizzle-orm'
import { config } from '../config/index.js'
import type { Database } from '../db/index.js'
import { accounts, apiTokens, apps } from '../db/schema.js'

// ── Response types (from @dify/contracts enterprise types.gen.ts) ────────────

interface Actor {
  id: string
  displayName: string
}

interface AccessChannels {
  id: string
  appInstanceId: string
  webAppEnabled: boolean
  developerApiEnabled: boolean
  updatedBy: Actor
  createdAt: string
  updatedAt: string
}

interface ApiKey {
  id: string
  appInstanceId: string
  environmentId: string
  displayName: string
  maskedToken: string
  createdBy: Actor
  createdAt: string
  lastUsedAt?: string
}

interface DeveloperApiUrl {
  apiUrl: string
  status: 'DEVELOPER_API_URL_STATUS_UNSPECIFIED' | 'DEVELOPER_API_URL_STATUS_CONFIGURED' | 'DEVELOPER_API_URL_STATUS_NOT_CONFIGURED'
  error?: { code?: string, message?: string }
}

export interface GetDeveloperApiSettingsResponse {
  accessChannels: AccessChannels
  environments: unknown[]
  apiKeys: ApiKey[]
  developerApiUrl: DeveloperApiUrl
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date: Date | null | undefined): string {
  return date ? date.toISOString() : new Date().toISOString()
}

/** Mask token: show last 4 chars, replace the rest with '****'. */
function maskToken(token: string): string {
  if (token.length <= 4) return '****'
  return `****${token.slice(-4)}`
}

// ── Service ──────────────────────────────────────────────────────────────────

export const developerApiService = {
  /**
   * Get developer API settings for a given app instance.
   * Assembles access channels, API keys, and developer API URL from local DB.
   */
  async getSettings(
    db: Database,
    accountId: string,
    tenantId: string,
    appInstanceId: string,
  ): Promise<GetDeveloperApiSettingsResponse | null> {
    // 1. Verify app exists and belongs to tenant
    const [app] = await db
      .select()
      .from(apps)
      .where(and(eq(apps.id, appInstanceId), eq(apps.tenantId, tenantId)))

    if (!app) return null

    // 2. Fetch current user for Actor fields
    const [user] = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, accountId))

    const actor: Actor = {
      id: user?.id ?? accountId,
      displayName: user?.name ?? 'Unknown',
    }

    // 3. Build accessChannels (self-hosted: everything enabled)
    const accessChannels: AccessChannels = {
      id: `ac-${appInstanceId}`,
      appInstanceId,
      webAppEnabled: app.enableSite,
      developerApiEnabled: app.enableApi,
      updatedBy: actor,
      createdAt: toISO(app.createdAt),
      updatedAt: toISO(app.updatedAt),
    }

    // 4. Query api_tokens for this app
    const tokenRows = await db
      .select({
        id: apiTokens.id,
        token: apiTokens.token,
        createdAt: apiTokens.createdAt,
        lastUsedAt: apiTokens.lastUsedAt,
      })
      .from(apiTokens)
      .where(and(eq(apiTokens.appId, appInstanceId), eq(apiTokens.type, 'app')))

    const apiKeys: ApiKey[] = tokenRows.map((row) => ({
      id: row.id,
      appInstanceId,
      environmentId: 'default',
      displayName: `API Key ${row.id.slice(0, 8)}`,
      maskedToken: maskToken(row.token),
      createdBy: actor,
      createdAt: toISO(row.createdAt),
      ...(row.lastUsedAt ? { lastUsedAt: toISO(row.lastUsedAt) } : {}),
    }))

    // 5. Build developerApiUrl
    const apiBaseUrl = config.consoleApiUrl.replace(/\/$/, '')
    const developerApiUrl: DeveloperApiUrl = {
      apiUrl: `${apiBaseUrl}/v1/workflows/run`,
      status: 'DEVELOPER_API_URL_STATUS_CONFIGURED',
    }

    return {
      accessChannels,
      environments: [],
      apiKeys,
      developerApiUrl,
    }
  },
}
