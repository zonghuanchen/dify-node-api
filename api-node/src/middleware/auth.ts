import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types/hono-env.js'
import { AuthError } from '../lib/errors.js'
import { getAccessTokenFromCookie } from '../lib/cookie.js'
import { verifyAccessToken } from '../lib/jwt.js'

/**
 * Authentication middleware — extracts and verifies the JWT access token.
 * Sets accountId on the context for downstream handlers.
 *
 * Token sources (in order of priority):
 * 1. Authorization: Bearer <token> header
 * 2. access_token cookie
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Try Authorization header first
  const authHeader = c.req.header('Authorization')
  let token: string | undefined

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  else {
    // Fall back to cookie
    token = getAccessTokenFromCookie(c)
  }

  if (!token) {
    throw new AuthError('Authentication required.')
  }

  const decoded = verifyAccessToken(token)
  c.set('accountId', decoded.user_id)

  await next()
}
