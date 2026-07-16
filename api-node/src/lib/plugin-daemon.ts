/**
 * Plugin Daemon HTTP client.
 *
 * Mirrors Python `api/core/plugin/impl/base.py` `BasePluginClient._request_with_plugin_daemon_response`.
 * All plugin daemon requests go through `{PLUGIN_DAEMON_URL}/{path}` with an
 * `X-Api-Key` header for authentication.
 *
 * Response format from the daemon:
 *   { code: number, message: string, data: T }
 *
 * - code === 0 → success, return data
 * - code !== 0 → error (client-side 4xx or server-side 5xx)
 */

import { config } from '../config/index.js'
import { AppError } from './errors.js'

// ── Error types ───────────────────────────────────────────────────────────────

/** Thrown when the plugin daemon returns a client-side error (code < 500). */
export class PluginDaemonClientError extends AppError {
  constructor(message: string) {
    super(400, 'plugin_error', message)
    this.name = 'PluginDaemonClientError'
  }
}

/** Thrown when the plugin daemon returns a server-side error (code >= 500). */
export class PluginDaemonServerError extends AppError {
  constructor(message: string) {
    super(500, 'plugin_daemon_error', message)
    this.name = 'PluginDaemonServerError'
  }
}

// ── Response shape ────────────────────────────────────────────────────────────

interface PluginDaemonResponse<T> {
  code: number
  message: string
  data: T | null
}

// ── Request options ───────────────────────────────────────────────────────────

interface RequestOptions {
  /** URL query parameters (appended to the daemon URL). */
  params?: Record<string, string | number | boolean>
  /** JSON body for POST/PUT requests. */
  body?: unknown
  /** Additional headers to merge with the defaults. */
  headers?: Record<string, string>
}

// ── Core request function ─────────────────────────────────────────────────────

/**
 * Make a request to the Plugin Daemon inner API and return the parsed `data` field.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param path   - Daemon-relative path, e.g. `plugin/{tenant_id}/management/install/tasks`
 * @param opts   - Optional query params, body, and extra headers
 * @returns The `data` field from the daemon response
 * @throws {PluginDaemonClientError} on 4xx-level daemon errors
 * @throws {PluginDaemonServerError} on 5xx-level daemon errors or network failures
 */
export async function requestPluginDaemon<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, config.pluginDaemonUrl)

  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    'X-Api-Key': config.pluginDaemonKey,
    'Accept-Encoding': 'gzip, deflate, br',
    ...opts.headers,
  }

  const init: RequestInit = { method, headers }

  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(opts.body)
  }

  let response: Response
  try {
    response = await fetch(url.toString(), init)
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new PluginDaemonServerError(`Failed to request plugin daemon: ${msg}`)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status < 500) {
      throw new PluginDaemonClientError(`Plugin daemon error (${response.status}): ${text}`)
    }
    throw new PluginDaemonServerError(`Plugin daemon server error (${response.status}): ${text}`)
  }

  let json: PluginDaemonResponse<T>
  try {
    json = await response.json() as PluginDaemonResponse<T>
  }
  catch {
    throw new PluginDaemonServerError('Failed to parse plugin daemon response as JSON')
  }

  if (json.code !== 0) {
    // Mirror Python: try to parse message as JSON error object, fall back to raw message.
    let errorMessage = json.message
    try {
      const parsed = JSON.parse(json.message) as { error_type?: string; message?: string }
      if (parsed.message) {
        errorMessage = parsed.message
      }
    }
    catch {
      // use raw message
    }

    throw new PluginDaemonClientError(errorMessage)
  }

  if (json.data === null || json.data === undefined) {
    throw new PluginDaemonServerError('Got empty data from plugin daemon')
  }

  return json.data
}
