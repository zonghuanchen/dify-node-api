/**
 * File service — mirrors Python api/services/file_service.py and
 * api/controllers/console/files.py FileApi.
 *
 * GET  /console/api/files/upload  -> upload config (limits)
 * POST /console/api/files/upload  -> upload file (local storage)
 */

import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/index.js'
import { uploadFiles } from '../db/schema.js'
import type { Database } from '../db/index.js'
import { AppError } from '../lib/errors.js'

// ── Error classes ────────────────────────────────────────────────────────────

export class NoFileUploadedError extends AppError {
  constructor() {
    super(400, 'no_file_uploaded', 'Please upload your file.')
    this.name = 'NoFileUploadedError'
  }
}

export class TooManyFilesError extends AppError {
  constructor() {
    super(400, 'too_many_files', 'Only one file is allowed per request.')
    this.name = 'TooManyFilesError'
  }
}

export class FilenameNotExistsError extends AppError {
  constructor() {
    super(400, 'filename_not_exists_error', 'The uploaded file has no filename.')
    this.name = 'FilenameNotExistsError'
  }
}

export class FileTooLargeError extends AppError {
  constructor() {
    super(413, 'file_too_large', 'File size exceeds the allowed limit.')
    this.name = 'FileTooLargeError'
  }
}

export class UnsupportedFileTypeError extends AppError {
  constructor() {
    super(415, 'unsupported_file_type', 'File type not allowed.')
    this.name = 'UnsupportedFileTypeError'
  }
}

export class BlockedFileExtensionError extends AppError {
  constructor(extension: string) {
    super(415, 'blocked_file_extension', `File extension '.${extension}' is not allowed for security reasons.`)
    this.name = 'BlockedFileExtensionError'
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a'])

/** Image/Video/Audio classification for size limit checks. */
function getFileSizeLimit(extension: string): number {
  const ext = extension.toLowerCase()
  if (IMAGE_EXTENSIONS.has(ext)) return config.uploadImageFileSizeLimit * 1024 * 1024
  if (VIDEO_EXTENSIONS.has(ext)) return config.uploadVideoFileSizeLimit * 1024 * 1024
  if (AUDIO_EXTENSIONS.has(ext)) return config.uploadAudioFileSizeLimit * 1024 * 1024
  return config.uploadFileSizeLimit * 1024 * 1024
}

// ── Upload config response ───────────────────────────────────────────────────

export interface UploadConfigResponse {
  file_size_limit: number
  batch_count_limit: number
  file_upload_limit: number
  image_file_size_limit: number
  video_file_size_limit: number
  audio_file_size_limit: number
  workflow_file_upload_limit: number
  image_file_batch_limit: number
  single_chunk_attachment_limit: number
  attachment_image_file_size_limit: number
}

export function getUploadConfig(): UploadConfigResponse {
  return {
    file_size_limit: config.uploadFileSizeLimit,
    batch_count_limit: config.uploadFileBatchLimit,
    file_upload_limit: config.batchUploadLimit,
    image_file_size_limit: config.uploadImageFileSizeLimit,
    video_file_size_limit: config.uploadVideoFileSizeLimit,
    audio_file_size_limit: config.uploadAudioFileSizeLimit,
    workflow_file_upload_limit: config.workflowFileUploadLimit,
    image_file_batch_limit: config.imageFileBatchLimit,
    single_chunk_attachment_limit: config.singleChunkAttachmentLimit,
    attachment_image_file_size_limit: config.attachmentImageFileSizeLimit,
  }
}

// ── File upload response ─────────────────────────────────────────────────────

export interface FileUploadResponse {
  id: string
  name: string
  size: number
  extension: string
  mime_type: string
  url: string
  created_at: number
}

// ── Service ──────────────────────────────────────────────────────────────────

export const fileService = {
  /**
   * Upload a file using local storage.
   * Mirrors Python FileService.upload_file() from api/services/file_service.py.
   */
  async uploadFile(
    db: Database,
    params: {
      filename: string
      content: Uint8Array
      mimetype: string
      accountId: string
      tenantId: string
      source?: 'datasets' | null
    },
  ): Promise<FileUploadResponse> {
    const { filename: originalFilename, content, mimetype, accountId, tenantId, source } = params

    // Extract extension
    const ext = path.extname(originalFilename).replace(/^\./, '').toLowerCase()

    // Validate filename
    if (/[\\/]/.test(originalFilename)) {
      throw new AppError(400, 'invalid_filename', 'Filename contains invalid characters.')
    }

    // Truncate if too long
    let filename = originalFilename
    if (filename.length > 200) {
      const base = filename.split('.')[0] || ''
      filename = base.slice(0, 200) + (ext ? `.${ext}` : '')
    }

    // Check extension blacklist
    if (ext && config.uploadFileExtensionBlacklist.includes(ext)) {
      throw new BlockedFileExtensionError(ext)
    }

    // Check file size
    const fileSizeLimit = getFileSizeLimit(ext)
    if (content.byteLength > fileSizeLimit) {
      throw new FileTooLargeError()
    }

    // Generate file key
    const fileUuid = uuidv4()
    const fileKey = `upload_files/${tenantId}/${fileUuid}${ext ? `.${ext}` : ''}`

    // Save to local storage
    const storageDir = path.join(process.cwd(), 'storage', 'upload_files', tenantId)
    await mkdir(storageDir, { recursive: true })
    const storagePath = path.join(process.cwd(), 'storage', fileKey)
    await writeFile(storagePath, content)

    // Compute hash
    const hash = createHash('sha3-256').update(content).digest('hex')

    // Insert DB record
    const fileId = uuidv4()
    const now = new Date()

    await db.insert(uploadFiles).values({
      id: fileId,
      tenantId,
      storageType: config.storageType,
      key: fileKey,
      name: filename,
      size: content.byteLength,
      extension: ext,
      mimeType: mimetype,
      createdByRole: 'account',
      createdBy: accountId,
      createdAt: now,
      used: false,
      hash,
      sourceUrl: '',
    })

    return {
      id: fileId,
      name: filename,
      size: content.byteLength,
      extension: ext,
      mime_type: mimetype,
      url: `${config.consoleApiUrl}/console/api/files/${fileId}/preview`,
      created_at: Math.floor(now.getTime() / 1000),
    }
  },
}
