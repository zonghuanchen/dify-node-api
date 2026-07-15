import { Hono } from 'hono'
import { z } from 'zod'
import { accountService } from '../../../services/account.service.js'
import type { AppEnv } from '../../../types/hono-env.js'
import {
  AuthenticationFailedError,
  EmailPasswordLoginLimitError,
} from '../../../lib/errors.js'
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setCsrfTokenCookie,
  getRefreshTokenFromCookie,
  getAccessTokenFromCookie,
  clearAuthCookies,
} from '../../../lib/cookie.js'
import { verifyAccessToken } from '../../../lib/jwt.js'
import { decryptField } from '../../../lib/encryption.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  language: z.string().optional(),
  remember_me: z.boolean().optional().default(false),
})

const loginRoute = new Hono<AppEnv>()

/**
 * POST /login — email + password login.
 * Mirrors Python LoginApi (POST /console/api/login).
 */
loginRoute.post(
  '/login',
  async (c) => {
    const body = await c.req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ status: 'error', code: 'validation_error', message: parsed.error.message }, 400)
    }
    const { email, password: encodedPassword } = parsed.data
    const db = c.get('db')
    const normalizedEmail = email.toLowerCase()

    // Decode base64-encoded password from frontend (mirrors Python @decrypt_password_field)
    const password = decryptField(encodedPassword)
    if (password === null) {
      throw new AuthenticationFailedError()
    }

    // Check rate limit
    const isRateLimited = await accountService.isLoginErrorRateLimit(normalizedEmail)
    if (isRateLimited) {
      throw new EmailPasswordLoginLimitError()
    }

    // Authenticate
    try {
      const account = await accountService.authenticateWithCaseFallback(db, email, normalizedEmail, password)

      // Check tenants
      const joinTenants = await accountService.getJoinTenants(db, account.id)
      if (joinTenants.length === 0) {
        return c.json({
          result: 'fail',
          data: 'workspace not found, please contact system admin to invite you to join in a workspace',
        })
      }

      // Login — generate token pair
      const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
      const tokenPair = await accountService.login(db, account, ipAddress)

      // Reset rate limit on success
      await accountService.resetLoginErrorRateLimit(normalizedEmail)

      // Set cookies
      setAccessTokenCookie(c, tokenPair.access_token)
      setRefreshTokenCookie(c, tokenPair.refresh_token)
      setCsrfTokenCookie(c, tokenPair.csrf_token)

      return c.json({ result: 'success' })
    }
    catch (err) {
      if (err instanceof AuthenticationFailedError) {
        await accountService.addLoginErrorRateLimit(normalizedEmail)
      }
      throw err
    }
  },
)

/**
 * POST /logout — clear auth cookies and revoke refresh token.
 * Mirrors Python LogoutApi (POST /console/api/logout).
 */
loginRoute.post(
  '/logout',
  async (c) => {
    // Extract account ID from access token (best-effort)
    const accessToken = getAccessTokenFromCookie(c)
    if (accessToken) {
      try {
        const decoded = verifyAccessToken(accessToken)
        await accountService.logout(decoded.user_id)
      }
      catch {
        // Token already expired or invalid — proceed with cookie clearing
      }
    }

    clearAuthCookies(c)
    return c.json({ result: 'success' })
  },
)

/**
 * POST /refresh-token — refresh access + refresh + CSRF tokens.
 * Mirrors Python RefreshTokenApi (POST /console/api/refresh-token).
 */
loginRoute.post(
  '/refresh-token',
  async (c) => {
    const db = c.get('db')
    const refreshToken = getRefreshTokenFromCookie(c)

    if (!refreshToken) {
      return c.json({ result: 'fail', message: 'No refresh token provided' }, 401)
    }

    const tokenPair = await accountService.refreshToken(db, refreshToken)

    setAccessTokenCookie(c, tokenPair.access_token)
    setRefreshTokenCookie(c, tokenPair.refresh_token)
    setCsrfTokenCookie(c, tokenPair.csrf_token)

    return c.json({ result: 'success' })
  },
)

export { loginRoute }
