/**
 * Plugin install/uninstall/upgrade service.
 *
 * Mirrors Python:
 * - `api/core/plugin/plugin_service.py` install/uninstall/upgrade methods
 * - `api/core/plugin/impl/plugin.py` daemon calls
 *
 * All plugin daemon requests go through `{PLUGIN_DAEMON_URL}/{path}` with an
 * `X-Api-Key` header for authentication.
 */

import { and, eq, inArray, like } from 'drizzle-orm'
import { config } from '../config/index.js'
import { providers, providerCredentials, tenantPreferredModelProviders } from '../db/schema.js'
import { PluginDaemonClientError, requestPluginDaemon } from '../lib/plugin-daemon.js'
import { redis } from '../lib/redis.js'
import type { Database } from '../db/index.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PluginDecodeResponse {
  unique_identifier: string
  manifest: Record<string, unknown>
  verification: Record<string, unknown> | null
}

export interface PluginInstallTaskStartResponse {
  all_installed: boolean
  task_id: string
}

export interface PluginBundleDependency {
  plugin_unique_identifier: string
  manifest: Record<string, unknown>
}

// ── Redis cache keys (mirror Python PluginService) ────────────────────────────

const CACHE_KEY_PREFIX = 'plugin_model_providers:tenant_id:'
const GENERATION_KEY_PREFIX = 'plugin_model_providers_generation:tenant_id:'

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
    console.warn(`Failed to invalidate plugin model providers cache for tenant ${tenantId}`)
  }
}

// ── Daemon path helpers ───────────────────────────────────────────────────────

function daemonPath(tenantId: string, suffix: string): string {
  return `plugin/${tenantId}/${suffix}`
}

// ── Multipart upload to daemon ────────────────────────────────────────────────

/**
 * Upload binary data to the plugin daemon using multipart/form-data.
 * Returns the parsed daemon response data field.
 */
async function uploadMultipartToDaemon<T>(
  tenantId: string,
  path: string,
  fieldName: string,
  data: ArrayBuffer | Buffer,
  formFields?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, config.pluginDaemonUrl)
  const formData = new FormData()
  formData.append(fieldName, new Blob([new Uint8Array(data)], { type: 'application/octet-stream' }), fieldName)

  if (formFields) {
    for (const [key, value] of Object.entries(formFields)) {
      formData.append(key, value)
    }
  }

  const headers: Record<string, string> = {
    'X-Api-Key': config.pluginDaemonKey,
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status < 500) {
      throw new PluginDaemonClientError(`Plugin daemon error (${response.status}): ${text}`)
    }
    throw new Error(`Plugin daemon server error (${response.status}): ${text}`)
  }

  const json = (await response.json()) as { code: number; message: string; data: T | null }
  if (json.code !== 0) {
    throw new PluginDaemonClientError(json.message)
  }
  if (json.data === null || json.data === undefined) {
    throw new Error('Got empty data from plugin daemon')
  }
  return json.data
}

// ── GitHub download helper ────────────────────────────────────────────────────

async function downloadFromGithub(repo: string, version: string, pkg: string, maxSize: number): Promise<ArrayBuffer> {
  const url = `https://github.com/${repo}/releases/download/${version}/${pkg}`
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download from GitHub: ${response.status}`)
  }

  const contentLength = Number(response.headers.get('content-length') || '0')
  if (contentLength > maxSize) {
    throw new Error('File size exceeds the maximum allowed size')
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > maxSize) {
    throw new Error('File size exceeds the maximum allowed size')
  }
  return buffer
}

// ── Marketplace download helper ───────────────────────────────────────────────

async function downloadPluginPkg(pluginUniqueIdentifier: string, maxSize: number): Promise<ArrayBuffer> {
  const url = `${config.marketplaceApiUrl}/api/v1/plugins/download?unique_identifier=${encodeURIComponent(pluginUniqueIdentifier)}`
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download plugin pkg: ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > maxSize) {
    throw new Error('File size exceeds the maximum allowed size')
  }
  return buffer
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Upload a plugin package.
 * Mirrors Python `PluginInstaller.upload_pkg`.
 */
export async function uploadPkg(
  tenantId: string,
  pkg: ArrayBuffer,
  verifySignature: boolean = false,
): Promise<PluginDecodeResponse> {
  return uploadMultipartToDaemon<PluginDecodeResponse>(
    tenantId,
    daemonPath(tenantId, 'management/install/upload/package'),
    'dify_pkg',
    pkg,
    { verify_signature: verifySignature ? 'true' : 'false' },
  )
}

/**
 * Upload a plugin bundle.
 * Mirrors Python `PluginInstaller.upload_bundle`.
 */
export async function uploadBundle(
  tenantId: string,
  bundle: ArrayBuffer,
  verifySignature: boolean = false,
): Promise<PluginBundleDependency[]> {
  return uploadMultipartToDaemon<PluginBundleDependency[]>(
    tenantId,
    daemonPath(tenantId, 'management/install/upload/bundle'),
    'dify_bundle',
    bundle,
    { verify_signature: verifySignature ? 'true' : 'false' },
  )
}

/**
 * Upload from GitHub release.
 * Mirrors Python `PluginService.upload_pkg_from_github`.
 */
export async function uploadPkgFromGithub(
  tenantId: string,
  repo: string,
  version: string,
  pkg: string,
): Promise<PluginDecodeResponse> {
  const data = await downloadFromGithub(repo, version, pkg, config.pluginMaxPackageSize)
  return uploadPkg(tenantId, data)
}

/**
 * Install plugins from local pkg identifiers.
 * Mirrors Python `PluginService.install_from_local_pkg`.
 */
export async function installFromLocalPkg(
  tenantId: string,
  pluginUniqueIdentifiers: string[],
): Promise<PluginInstallTaskStartResponse> {
  // Decode and validate each identifier
  for (const identifier of pluginUniqueIdentifiers) {
    await decodePluginFromIdentifier(tenantId, identifier)
  }

  const result = await requestPluginDaemon<PluginInstallTaskStartResponse>(
    'POST',
    daemonPath(tenantId, 'management/install/identifiers'),
    {
      body: {
        plugin_unique_identifiers: pluginUniqueIdentifiers,
        source: 'package',
        metas: pluginUniqueIdentifiers.map((id) => ({ plugin_unique_identifier: id })),
      },
    },
  )

  await invalidatePluginModelProvidersCache(tenantId)
  return result
}

/**
 * Install plugin from GitHub.
 * Mirrors Python `PluginService.install_from_github`.
 */
export async function installFromGithub(
  tenantId: string,
  pluginUniqueIdentifier: string,
  repo: string,
  version: string,
  pkg: string,
): Promise<PluginInstallTaskStartResponse> {
  // Decode first
  await decodePluginFromIdentifier(tenantId, pluginUniqueIdentifier)

  const result = await requestPluginDaemon<PluginInstallTaskStartResponse>(
    'POST',
    daemonPath(tenantId, 'management/install/identifiers'),
    {
      body: {
        plugin_unique_identifiers: [pluginUniqueIdentifier],
        source: 'github',
        metas: [{ repo, version, package: pkg }],
      },
    },
  )

  await invalidatePluginModelProvidersCache(tenantId)
  return result
}

/**
 * Install plugins from marketplace.
 * Mirrors Python `PluginService.install_from_marketplace_pkg`.
 */
export async function installFromMarketplacePkg(
  tenantId: string,
  pluginUniqueIdentifiers: string[],
): Promise<PluginInstallTaskStartResponse> {
  if (!config.marketplaceEnabled) {
    throw new Error('Marketplace is not enabled')
  }

  const actualIdentifiers: string[] = []
  const metas: Record<string, string>[] = []

  for (const identifier of pluginUniqueIdentifiers) {
    try {
      // Check if already available
      await fetchPluginManifestFromDaemon(tenantId, identifier)
      actualIdentifiers.push(identifier)
      metas.push({ plugin_unique_identifier: identifier })
    }
    catch {
      // Download and upload
      const pkgData = await downloadPluginPkg(identifier, config.pluginMaxPackageSize)
      const response = await uploadPkg(tenantId, pkgData)
      actualIdentifiers.push(response.unique_identifier)
      metas.push({ plugin_unique_identifier: response.unique_identifier })
    }
  }

  const result = await requestPluginDaemon<PluginInstallTaskStartResponse>(
    'POST',
    daemonPath(tenantId, 'management/install/identifiers'),
    {
      body: {
        plugin_unique_identifiers: actualIdentifiers,
        source: 'marketplace',
        metas,
      },
    },
  )

  await invalidatePluginModelProvidersCache(tenantId)
  return result
}

/**
 * Fetch marketplace package manifest.
 * Mirrors Python `PluginService.fetch_marketplace_pkg`.
 */
export async function fetchMarketplacePkg(
  tenantId: string,
  pluginUniqueIdentifier: string,
): Promise<Record<string, unknown>> {
  if (!config.marketplaceEnabled) {
    throw new Error('Marketplace is not enabled')
  }

  try {
    // Try fetching manifest from daemon first
    const manifest = await fetchPluginManifestFromDaemon(tenantId, pluginUniqueIdentifier)
    return manifest
  }
  catch {
    // Download from marketplace, upload to daemon, return manifest
    const pkgData = await downloadPluginPkg(pluginUniqueIdentifier, config.pluginMaxPackageSize)
    const response = await uploadPkg(tenantId, pkgData)
    return response.manifest as Record<string, unknown>
  }
}

/**
 * Uninstall a plugin.
 * Mirrors Python `PluginService.uninstall`.
 * Handles DB cleanup (preferred model providers, provider credentials, providers) before daemon call.
 */
export async function uninstallPlugin(
  db: Database,
  tenantId: string,
  pluginInstallationId: string,
): Promise<boolean> {
  // List plugins from daemon to find the one being uninstalled
  let pluginId: string | null = null

  try {
    const plugins = await requestPluginDaemon<Array<{
      installation_id: string
      plugin_id: string
      plugin_unique_identifier: string
    }>>(
      'GET',
      daemonPath(tenantId, 'management/list'),
      { params: { page: 1, page_size: 256, response_type: 'paged' } },
    )

    const plugin = plugins.find((p) => p.installation_id === pluginInstallationId)
    if (plugin) {
      pluginId = plugin.plugin_id
    }
  }
  catch {
    // If listing fails, proceed with uninstall anyway
  }

  // DB cleanup if we found the plugin
  if (pluginId) {
    const pattern = `${pluginId}/%`

    // Delete tenant preferred model providers
    await db
      .delete(tenantPreferredModelProviders)
      .where(
        and(
          eq(tenantPreferredModelProviders.tenantId, tenantId),
          like(tenantPreferredModelProviders.providerName, pattern),
        ),
      )

    // Find and clean up provider credentials
    const credentialRows = await db
      .select({ id: providerCredentials.id })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.tenantId, tenantId),
          like(providerCredentials.providerName, pattern),
        ),
      )

    const credentialIds = credentialRows.map((r) => r.id)

    if (credentialIds.length > 0) {
      // Find providers with these credentials and nullify their credential_id
      const providerRows = await db
        .select({ id: providers.id })
        .from(providers)
        .where(
          and(
            eq(providers.tenantId, tenantId),
            like(providers.providerName, pattern),
            inArray(providers.credentialId, credentialIds),
          ),
        )

      const providerIds = providerRows.map((r) => r.id)

      if (providerIds.length > 0) {
        await db
          .update(providers)
          .set({ credentialId: null })
          .where(inArray(providers.id, providerIds))
      }

      // Delete the credentials
      await db
        .delete(providerCredentials)
        .where(inArray(providerCredentials.id, credentialIds))
    }
  }

  // Call daemon to uninstall
  const result = await requestPluginDaemon<boolean>(
    'POST',
    daemonPath(tenantId, 'management/uninstall'),
    { body: { plugin_installation_id: pluginInstallationId } },
  )

  if (result) {
    await invalidatePluginModelProvidersCache(tenantId)
  }
  return result
}

/**
 * Upgrade plugin from marketplace.
 * Mirrors Python `PluginService.upgrade_plugin_with_marketplace`.
 */
export async function upgradePluginWithMarketplace(
  tenantId: string,
  originalPluginUniqueIdentifier: string,
  newPluginUniqueIdentifier: string,
): Promise<PluginInstallTaskStartResponse> {
  if (!config.marketplaceEnabled) {
    throw new Error('Marketplace is not enabled')
  }

  if (originalPluginUniqueIdentifier === newPluginUniqueIdentifier) {
    throw new Error('Cannot upgrade plugin with the same plugin')
  }

  try {
    // Check if already downloaded
    await fetchPluginManifestFromDaemon(tenantId, newPluginUniqueIdentifier)
  }
  catch {
    // Download and upload
    const pkgData = await downloadPluginPkg(newPluginUniqueIdentifier, config.pluginMaxPackageSize)
    await uploadPkg(tenantId, pkgData)
  }

  const result = await requestPluginDaemon<PluginInstallTaskStartResponse>(
    'POST',
    daemonPath(tenantId, 'management/install/upgrade'),
    {
      body: {
        original_plugin_unique_identifier: originalPluginUniqueIdentifier,
        new_plugin_unique_identifier: newPluginUniqueIdentifier,
        source: 'marketplace',
        meta: { plugin_unique_identifier: newPluginUniqueIdentifier },
      },
    },
  )

  await invalidatePluginModelProvidersCache(tenantId)
  return result
}

/**
 * Upgrade plugin from GitHub.
 * Mirrors Python `PluginService.upgrade_plugin_with_github`.
 */
export async function upgradePluginWithGithub(
  tenantId: string,
  originalPluginUniqueIdentifier: string,
  newPluginUniqueIdentifier: string,
  repo: string,
  version: string,
  pkg: string,
): Promise<PluginInstallTaskStartResponse> {
  const result = await requestPluginDaemon<PluginInstallTaskStartResponse>(
    'POST',
    daemonPath(tenantId, 'management/install/upgrade'),
    {
      body: {
        original_plugin_unique_identifier: originalPluginUniqueIdentifier,
        new_plugin_unique_identifier: newPluginUniqueIdentifier,
        source: 'github',
        meta: { repo, version, package: pkg },
      },
    },
  )

  await invalidatePluginModelProvidersCache(tenantId)
  return result
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchPluginManifestFromDaemon(
  tenantId: string,
  pluginUniqueIdentifier: string,
): Promise<Record<string, unknown>> {
  return requestPluginDaemon<Record<string, unknown>>(
    'GET',
    daemonPath(tenantId, 'management/fetch/manifest'),
    { params: { plugin_unique_identifier: pluginUniqueIdentifier } },
  )
}

async function decodePluginFromIdentifier(
  tenantId: string,
  pluginUniqueIdentifier: string,
): Promise<PluginDecodeResponse> {
  return requestPluginDaemon<PluginDecodeResponse>(
    'GET',
    daemonPath(tenantId, 'management/decode/from_identifier'),
    {
      params: {
        plugin_unique_identifier: pluginUniqueIdentifier,
        PluginUniqueIdentifier: pluginUniqueIdentifier, // compat with daemon <= 0.5.4
      },
    },
  )
}
