/**
 * Files route — mirrors Python api/controllers/console/files.py FileApi.
 *
 * GET  /console/api/files/upload  -> upload config (limits)
 * POST /console/api/files/upload  -> upload file (local storage)
 */

import { Hono } from 'hono'
import { requireAccountInitialized } from '../../middleware/account-init.js'
import { requireAuth } from '../../middleware/auth.js'
import { resolveTenant } from '../../middleware/tenant.js'
import { fileService, getUploadConfig, NoFileUploadedError, TooManyFilesError, FilenameNotExistsError } from '../../services/file.service.js'
import type { AppEnv } from '../../types/hono-env.js'

export const filesRoute = new Hono<AppEnv>()

/**
 * GET /files/upload
 * Returns upload configuration (file size limits, batch limits, etc.)
 * Mirrors Python FileApi.get() from controllers/console/files.py L64-77.
 */
filesRoute.get(
  '/files/upload',
  requireAuth,
  requireAccountInitialized,
  (c) => {
    return c.json(getUploadConfig())
  },
)

/**
 * POST /files/upload
 * Handles file upload with multipart/form-data.
 * Mirrors Python FileApi.post() from controllers/console/files.py L86-121.
 */
filesRoute.post(
  '/files/upload',
  requireAuth,
  requireAccountInitialized,
  resolveTenant,
  async (c) => {
    const accountId = c.get('accountId')!
    const tenantId = c.get('tenantId')!
    const db = c.get('db')

    // Parse multipart body
    const body = await c.req.parseBody({ all: true })

    // Validate file presence
    const fileField = body['file']
    if (!fileField || !(fileField instanceof File)) {
      throw new NoFileUploadedError()
    }

    // Check for multiple files (only one allowed)
    // parseBody with all: true wraps multiple files in array, single file stays as File
    if (Array.isArray(fileField)) {
      throw new TooManyFilesError()
    }

    const file = fileField as File
    if (!file.name) {
      throw new FilenameNotExistsError()
    }

    const sourceStr = body['source'] as string | undefined
    const source = sourceStr === 'datasets' ? 'datasets' as const : null

    const content = new Uint8Array(await file.arrayBuffer())

    const result = await fileService.uploadFile(db, {
      filename: file.name,
      content,
      mimetype: file.type || 'application/octet-stream',
      accountId,
      tenantId,
      source,
    })

    return c.json(result, 201)
  },
)
