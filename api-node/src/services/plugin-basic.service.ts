/**
 * Plugin basic service — daemon proxy endpoints.
 *
 * Mirrors Python `api/core/plugin/plugin_service.py` and `api/core/plugin/impl/*.py`
 * for debugging-key, latest-versions, installations-from-ids, fetch-manifest,
 * icon, asset, and readme endpoints.
 */

import { requestPluginDaemon } from '../lib/plugin-daemon.js'
import { redis } from '../lib/redis.js'
import { config } from '../config/index.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DebuggingKeyResponse {
  key: string
  host: string
  port: number
}

export interface LatestPluginCache {
  plugin_id: string
  version: string
  unique_identifier: string
  author: string | null
  created_at: string
  updated_at: string
}

export interface PluginDeclaration {
  version: string
  author: string | null
  name: string
  description: Record<string, string>
  icon: string
  icon_dark: string | null
  label: Record<string, string>
  category: string
  created_at: string
  resource: Record<string, unknown>
  plugins: Record<string, string[] | null>
  tags: string[]
  repo: string | null
  verified: boolean
  tool: Record<string, unknown> | null
  model: Record<string, unknown> | null
  endpoint: Record<string, unknown> | null
  agent_strategy: Record<string, unknown> | null
  datasource: Record<string, unknown> | null
  trigger: Record<string, unknown> | null
  meta: Record<string, unknown>
}

export interface PluginInstallation {
  id: string
  created_at: string
  updated_at: string
  tenant_id: string
  endpoints_setups: number
  endpoints_active: number
  runtime_type: string
  source: string
  meta: Record<string, unknown>
  plugin_id: string
  plugin_unique_identifier: string
  version: string
  checksum: string
  declaration: PluginDeclaration
}

// ── Redis cache keys (mirror Python PluginService) ────────────────────────────

const LATEST_VERSION_CACHE_PREFIX = 'plugin_latest_version:'
const LATEST_VERSION_CACHE_TTL = 3600 // 1 hour

// ── Daemon path helpers ───────────────────────────────────────────────────────

function daemonPath(tenantId: string, suffix: string): string {
  return `plugin/${tenantId}/${suffix}`
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Get debugging key for a tenant.
 * Mirrors Python `PluginDebuggingClient.get_debugging_key` + controller response.
 */
export async function getDebuggingKey(tenantId: string): Promise<DebuggingKeyResponse> {
  const result = await requestPluginDaemon<{ key: string }>(
    'POST',
    daemonPath(tenantId, 'debugging/key'),
  )

  return {
    key: result.key,
    host: config.pluginRemoteInstallHost,
    port: config.pluginRemoteInstallPort,
  }
}

/**
 * List latest plugin versions with Redis caching.
 * Mirrors Python `PluginService.list_latest_versions` / `fetch_latest_plugin_version`.
 *
 * Uses Redis cache first, then falls back to marketplace API for uncached IDs.
 */
export async function listLatestVersions(pluginIds: string[]): Promise<Record<string, LatestPluginCache | null>> {
  const result: Record<string, LatestPluginCache | null> = {}
  const uncached: string[] = []

  // Try Redis cache first
  for (const pluginId of pluginIds) {
    const cacheKey = `${LATEST_VERSION_CACHE_PREFIX}${pluginId}`
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        result[pluginId] = JSON.parse(cached) as LatestPluginCache
      }
      else {
        uncached.push(pluginId)
      }
    }
    catch {
      uncached.push(pluginId)
    }
  }

  // Fetch uncached from marketplace
  if (uncached.length > 0) {
    if (!config.marketplaceEnabled) {
      for (const id of uncached) {
        result[id] = null
      }
    }
    else {
      try {
        const manifests = await batchFetchPluginManifests(uncached)
        for (const manifest of manifests) {
          const entry: LatestPluginCache = {
            plugin_id: manifest.plugin_id,
            version: manifest.latest_version,
            unique_identifier: manifest.latest_package_identifier,
            author: manifest.author ?? null,
            created_at: manifest.created_at ?? new Date().toISOString(),
            updated_at: manifest.updated_at ?? new Date().toISOString(),
          }
          result[manifest.plugin_id] = entry

          // Cache in Redis
          const cacheKey = `${LATEST_VERSION_CACHE_PREFIX}${manifest.plugin_id}`
          try {
            await redis.set(cacheKey, JSON.stringify(entry), 'EX', LATEST_VERSION_CACHE_TTL)
          }
          catch {
            // Non-fatal
          }
        }
        // Mark missing plugins as null
        for (const id of uncached) {
          if (!(id in result)) {
            result[id] = null
          }
        }
      }
      catch {
        // On marketplace failure, return null for uncached
        for (const id of uncached) {
          if (!(id in result)) {
            result[id] = null
          }
        }
      }
    }
  }

  return result
}

/**
 * List plugin installations from a batch of plugin IDs.
 * Mirrors Python `PluginInstaller.fetch_plugin_installation_by_ids`.
 */
export async function listInstallationsFromIds(
  tenantId: string,
  pluginIds: string[],
): Promise<PluginInstallation[]> {
  return requestPluginDaemon<PluginInstallation[]>(
    'POST',
    daemonPath(tenantId, 'management/installation/fetch/batch'),
    { body: { plugin_ids: pluginIds } },
  )
}

/**
 * Fetch a plugin manifest from the daemon.
 * Mirrors Python `PluginInstaller.fetch_plugin_manifest`.
 */
export async function fetchPluginManifest(
  tenantId: string,
  pluginUniqueIdentifier: string,
): Promise<PluginDeclaration> {
  return requestPluginDaemon<PluginDeclaration>(
    'GET',
    daemonPath(tenantId, 'management/fetch/manifest'),
    { params: { plugin_unique_identifier: pluginUniqueIdentifier } },
  )
}

/**
 * Fetch a plugin icon asset (binary).
 * Mirrors Python `PluginAssetManager.fetch_asset`.
 */
export async function getAsset(
  tenantId: string,
  filename: string,
): Promise<{ data: ArrayBuffer; mimeType: string }> {
  // The daemon returns raw binary for asset endpoints.
  const url = new URL(daemonPath(tenantId, `asset/${filename}`), config.pluginDaemonUrl)
  const headers: Record<string, string> = {
    'X-Api-Key': config.pluginDaemonKey,
  }

  const response = await fetch(url.toString(), { method: 'GET', headers })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Failed to fetch asset: ${response.status} ${text}`)
  }

  const mimeType = response.headers.get('content-type') || 'application/octet-stream'
  const data = await response.arrayBuffer()
  return { data, mimeType }
}

/**
 * Extract a plugin asset (binary).
 * Mirrors Python `PluginAssetManager.extract_asset`.
 */
export async function extractAsset(
  tenantId: string,
  pluginUniqueIdentifier: string,
  fileName: string,
): Promise<ArrayBuffer> {
  const url = new URL(daemonPath(tenantId, 'extract-asset/'), config.pluginDaemonUrl)
  url.searchParams.set('plugin_unique_identifier', pluginUniqueIdentifier)
  url.searchParams.set('file_path', fileName)

  const headers: Record<string, string> = {
    'X-Api-Key': config.pluginDaemonKey,
  }

  const response = await fetch(url.toString(), { method: 'GET', headers })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Failed to extract asset: ${response.status} ${text}`)
  }

  return response.arrayBuffer()
}

/**
 * Fetch a plugin readme from the daemon.
 * Mirrors Python `PluginInstaller.fetch_plugin_readme`.
 */
export async function fetchPluginReadme(
  tenantId: string,
  pluginUniqueIdentifier: string,
  language: string,
): Promise<string> {
  try {
    const result = await requestPluginDaemon<{ content: string }>(
      'GET',
      daemonPath(tenantId, 'management/fetch/readme'),
      {
        params: {
          tenant_id: tenantId,
          plugin_unique_identifier: pluginUniqueIdentifier,
          language,
        },
      },
    )
    return result.content
  }
  catch (err) {
    // Mirror Python: return empty string on 404
    if (err instanceof Error && err.message.includes('404')) {
      return ''
    }
    throw err
  }
}

// ── Marketplace helpers (internal) ────────────────────────────────────────────

interface MarketplaceManifest {
  plugin_id: string
  latest_version: string
  latest_package_identifier: string
  author: string | null
  created_at: string
  updated_at: string
}

async function batchFetchPluginManifests(pluginIds: string[]): Promise<MarketplaceManifest[]> {
  if (pluginIds.length === 0) return []

  const url = `${config.marketplaceApiUrl}/api/v1/plugins/batch`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plugin_ids: pluginIds }),
  })

  if (!response.ok) {
    throw new Error(`Marketplace batch fetch failed: ${response.status}`)
  }

  const json = (await response.json()) as { data: { plugins: MarketplaceManifest[] } }
  return json.data.plugins
}
