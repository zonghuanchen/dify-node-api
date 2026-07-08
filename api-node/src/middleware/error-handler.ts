import type { ErrorHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from '../lib/errors.js'

/**
 * Global error handler for Hono.
 * Converts AppError instances to structured JSON responses,
 * and logs unhandled errors.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { status: 'error', code: err.code, message: err.message },
      err.statusCode as ContentfulStatusCode,
    )
  }

  console.error('[Unhandled]', err)
  return c.json(
    { status: 'error', code: 'internal_error', message: 'Internal Server Error' },
    500,
  )
}
