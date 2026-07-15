import { Hono } from 'hono'
import { z } from 'zod'
import { accountService } from '../../../services/account.service.js'
import type { AppEnv } from '../../../types/hono-env.js'
import {
  EmailAlreadyInUseError,
  EmailCodeError,
  EmailRegisterLimitError,
  InvalidEmailError,
  InvalidTokenError,
  PasswordMismatchError,
} from '../../../lib/errors.js'
import { validatePassword } from '../../../lib/password.js'
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setCsrfTokenCookie,
} from '../../../lib/cookie.js'

const sendEmailSchema = z.object({
  email: z.string().email(),
  language: z.string().optional(),
})

const validitySchema = z.object({
  email: z.string().email(),
  code: z.string(),
  token: z.string(),
})

const registerSchema = z.object({
  token: z.string(),
  new_password: z.string().min(8),
  password_confirm: z.string().min(8),
  language: z.string().optional(),
  timezone: z.string().optional(),
})

const registerRoute = new Hono<AppEnv>()

/**
 * POST /email-register/send-email — send registration verification code.
 * Mirrors Python EmailRegisterSendEmailApi.
 */
registerRoute.post(
  '/email-register/send-email',
  async (c) => {
    const body = await c.req.json()
    const parsed = sendEmailSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ status: 'error', code: 'validation_error', message: parsed.error.message }, 400)
    }

    const { email, language } = parsed.data
    const db = c.get('db')
    const normalizedEmail = email.toLowerCase()

    // Python behavior: allow existing accounts (sends different email template).
    // Check if account exists to determine which template to use.
    const existingAccount = await accountService.getAccountWithCaseFallback(db, email)

    // Generate verification code + token
    const { code, token } = await accountService.generateEmailRegisterToken(normalizedEmail)

    // TODO: Send actual email via task queue (different template for existing vs new accounts).
    // For now, return the token (and code in dev mode for testing).
    const responseData: Record<string, string> = { token }
    if (process.env.NODE_ENV === 'development') {
      responseData.code = code
    }

    return c.json({ result: 'success', data: responseData })
  },
)

/**
 * POST /email-register/validity — verify registration code.
 * Mirrors Python EmailRegisterCheckApi.
 */
registerRoute.post(
  '/email-register/validity',
  async (c) => {
    const body = await c.req.json()
    const parsed = validitySchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ status: 'error', code: 'validation_error', message: parsed.error.message }, 400)
    }

    const { email, code, token } = parsed.data
    const normalizedEmail = email.toLowerCase()

    // Check rate limit
    const isRateLimited = await accountService.isEmailRegisterErrorRateLimit(normalizedEmail)
    if (isRateLimited) {
      throw new EmailRegisterLimitError()
    }

    // Validate token
    const tokenData = await accountService.getEmailRegisterData(token)
    if (!tokenData) {
      throw new InvalidTokenError()
    }

    const tokenEmail = typeof tokenData.email === 'string' ? tokenData.email.toLowerCase() : ''
    if (normalizedEmail !== tokenEmail) {
      throw new InvalidEmailError()
    }

    if (code !== tokenData.code) {
      await accountService.addEmailRegisterErrorRateLimit(normalizedEmail)
      throw new EmailCodeError()
    }

    // Verified — revoke the first token and issue a new one for the register phase
    await accountService.revokeEmailRegisterToken(token)

    const { token: newToken } = await accountService.generateEmailRegisterToken(
      normalizedEmail,
      { code, phase: 'register' },
    )

    await accountService.resetEmailRegisterErrorRateLimit(normalizedEmail)

    return c.json({ is_valid: true, email: normalizedEmail, token: newToken })
  },
)

/**
 * POST /email-register — complete registration with password.
 * Mirrors Python EmailRegisterResetApi.
 */
registerRoute.post(
  '/email-register',
  async (c) => {
    const body = await c.req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ status: 'error', code: 'validation_error', message: parsed.error.message }, 400)
    }

    const { token, new_password, password_confirm, language, timezone } = parsed.data
    const db = c.get('db')

    // Validate passwords match
    if (new_password !== password_confirm) {
      throw new PasswordMismatchError()
    }

    // Validate password strength
    try {
      validatePassword(new_password)
    }
    catch (err) {
      return c.json({ status: 'error', code: 'validation_error', message: (err as Error).message }, 400)
    }

    // Validate token and get register data
    const registerData = await accountService.getEmailRegisterData(token)
    if (!registerData) {
      throw new InvalidTokenError()
    }
    if (registerData.phase !== 'register') {
      throw new InvalidTokenError()
    }

    // Revoke token to prevent reuse
    await accountService.revokeEmailRegisterToken(token)

    const email = typeof registerData.email === 'string' ? registerData.email.toLowerCase() : ''

    // Check if email already registered (case-fallback — mirrors Python get_account_by_email_with_case_fallback)
    const existingAccount = await accountService.getAccountWithCaseFallback(db, email)
    if (existingAccount) {
      throw new EmailAlreadyInUseError()
    }

    // Create new account with tenant
    const account = await accountService.createAccountAndTenant(db, {
      email,
      name: email,
      password: new_password,
      timezone,
      language,
    })

    // Login the new account
    const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip')
    const tokenPair = await accountService.login(db, account, ipAddress)
    await accountService.resetLoginErrorRateLimit(email)

    // Set cookies
    setAccessTokenCookie(c, tokenPair.access_token)
    setRefreshTokenCookie(c, tokenPair.refresh_token)
    setCsrfTokenCookie(c, tokenPair.csrf_token)

    return c.json({
      result: 'success',
      data: {
        access_token: tokenPair.access_token,
        refresh_token: tokenPair.refresh_token,
        csrf_token: tokenPair.csrf_token,
      },
    })
  },
)

export { registerRoute }
