/**
 * Optional authentication helper.
 * Mirrors Python `current_account_with_tenant_optional()` from api/libs/login.py.
 *
 * Attempts to extract and verify a JWT access token, returning the account ID
 * if successful. Returns null on any failure (no token, expired, invalid signature).
 * This is NOT a middleware — it never throws or blocks the request.
 */

import type { Context } from 'hono'
import { getAccessTokenFromCookie } from './cookie.js'
import { verifyAccessToken } from './jwt.js'

/**
 * Try to extract a verified account ID from the request.
 * Checks Authorization header first, then falls back to cookie.
 *
 * @returns account ID string if authenticated, null otherwise
 */
export function tryGetAccountId(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  let token: string | undefined

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  else {
    token = getAccessTokenFromCookie(c)
  }

  if (!token) {
    return null
  }

  try {
    const decoded = verifyAccessToken(token)
    return decoded.user_id
  }
  catch {
    return null
  }
}
