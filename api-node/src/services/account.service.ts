import { randomBytes } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config/index.js'
import type { Database } from '../db/index.js'
import { accounts, tenantAccountJoins, tenants } from '../db/schema.js'
import {
  ACCOUNT_REFRESH_TOKEN_PREFIX,
  EMAIL_REGISTER_ERROR_PREFIX,
  EMAIL_REGISTER_TOKEN_PREFIX,
  LOGIN_ERROR_RATE_LIMIT_PREFIX,
  REFRESH_TOKEN_PREFIX,
} from '../lib/constants.js'
import {
  AccountBannedError,
  AuthError,
  AuthenticationFailedError,
  RefreshTokenAccountNotFoundError,
  RefreshTokenNotFoundError,
} from '../lib/errors.js'
import { issueAccessToken, issueCsrfToken } from '../lib/jwt.js'
import { comparePassword, generatePasswordHash, validatePassword } from '../lib/password.js'
import { redis } from '../lib/redis.js'

// Refresh token expiry in seconds
const REFRESH_TOKEN_EXPIRY = config.refreshTokenExpireDays * 24 * 60 * 60

// Login rate limit: max 5 attempts per 10 minutes
const LOGIN_RATE_LIMIT_MAX = 5
const LOGIN_RATE_LIMIT_WINDOW = 600 // seconds

// Email register error rate limit: max 5 per 24h
const EMAIL_REGISTER_ERROR_MAX = 5
const EMAIL_REGISTER_ERROR_WINDOW = 86400 // seconds

// Email register token expiry: 15 minutes
const EMAIL_REGISTER_TOKEN_EXPIRY = 900

export interface TokenPair {
  access_token: string
  refresh_token: string
  csrf_token: string
}

/**
 * Account service — mirrors Python AccountService.
 * Handles authentication, registration, login/logout, and token management.
 */
export const accountService = {
  // ── Email lookup ──────────────────────────────────────────────────

  async getAccountByEmail(db: Database, email: string) {
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1)
    return row ?? null
  },

  /**
   * Case-insensitive fallback: tries original email, then lowercased.
   * Mirrors Python `_get_account_with_case_fallback()`.
   */
  async getAccountWithCaseFallback(db: Database, email: string) {
    const account = await accountService.getAccountByEmail(db, email)
    if (account || email === email.toLowerCase()) return account
    return accountService.getAccountByEmail(db, email.toLowerCase())
  },

  // ── Authentication ────────────────────────────────────────────────

  /**
   * Authenticates account with email + password.
   * Mirrors Python `AccountService.authenticate()`.
   */
  async authenticate(db: Database, email: string, password: string) {
    const account = await accountService.getAccountByEmail(db, email)
    if (!account) {
      throw new AuthenticationFailedError()
    }
    if (account.status === 'banned') {
      throw new AccountBannedError()
    }
    if (!account.password || !account.passwordSalt) {
      throw new AuthenticationFailedError()
    }
    if (!comparePassword(password, account.password, account.passwordSalt)) {
      throw new AuthenticationFailedError()
    }
    // Activate pending accounts
    if (account.status === 'pending') {
      await db
        .update(accounts)
        .set({ status: 'active', initializedAt: new Date() })
        .where(eq(accounts.id, account.id))
    }
    return account
  },

  /**
   * Case-fallback authenticate — tries original email, then lowercased.
   */
  async authenticateWithCaseFallback(db: Database, originalEmail: string, normalizedEmail: string, password: string) {
    try {
      return await accountService.authenticate(db, originalEmail, password)
    }
    catch (err) {
      if (originalEmail === normalizedEmail) throw err
      return accountService.authenticate(db, normalizedEmail, password)
    }
  },

  // ── Account creation ──────────────────────────────────────────────

  /**
   * Creates a new account with hashed password.
   * Mirrors Python `AccountService.create_account()`.
   */
  async createAccount(
    db: Database,
    params: { email: string; name: string; password?: string; timezone?: string; language?: string },
  ) {
    const { email, name, password, timezone, language } = params

    let passwordHash: string | null = null
    let passwordSalt: string | null = null
    if (password) {
      validatePassword(password)
      const result = generatePasswordHash(password)
      passwordHash = result.base64Hash
      passwordSalt = result.base64Salt
    }

    const now = new Date()
    const id = uuidv4()
    const [account] = await db
      .insert(accounts)
      .values({
        id,
        name,
        email,
        password: passwordHash,
        passwordSalt,
        interfaceLanguage: language ?? 'en-US',
        interfaceTheme: 'light',
        timezone: timezone ?? 'UTC',
        status: 'active',
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return account!
  },

  /**
   * Creates an account and a default owner workspace.
   * Mirrors Python `AccountService.create_account_and_tenant()`.
   */
  async createAccountAndTenant(
    db: Database,
    params: { email: string; name: string; password?: string; timezone?: string; language?: string },
  ) {
    const account = await accountService.createAccount(db, params)

    // Create default tenant
    const tenantId = uuidv4()
    await db.insert(tenants).values({
      id: tenantId,
      name: `${account.name}'s Workspace`,
      plan: 'basic',
      status: 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create tenant-account join (owner role)
    await db.insert(tenantAccountJoins).values({
      id: uuidv4(),
      tenantId,
      accountId: account.id,
      current: true,
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return account
  },

  // ── Login / Logout / Refresh ──────────────────────────────────────

  /**
   * Generates a token pair for the authenticated account.
   * Mirrors Python `AccountService.login()`.
   */
  async login(db: Database, account: { id: string; status: string }, ipAddress?: string): Promise<TokenPair> {
    // Update last login info
    const updateData: Record<string, unknown> = { lastActiveAt: new Date() }
    if (ipAddress) updateData.lastLoginIp = ipAddress
    updateData.lastLoginAt = new Date()

    if (account.status === 'pending') {
      updateData.status = 'active'
    }

    await db.update(accounts).set(updateData).where(eq(accounts.id, account.id))

    const accessToken = issueAccessToken(account.id)
    const refreshToken = randomBytes(64).toString('hex')
    const csrfToken = issueCsrfToken(account.id)

    await accountService.storeRefreshToken(refreshToken, account.id)

    return { access_token: accessToken, refresh_token: refreshToken, csrf_token: csrfToken }
  },

  /**
   * Clears the refresh token on logout.
   * Mirrors Python `AccountService.logout()`.
   */
  async logout(accountId: string) {
    try {
      const storedToken = await redis.get(`${ACCOUNT_REFRESH_TOKEN_PREFIX}${accountId}`)
      if (storedToken) {
        await accountService.deleteRefreshToken(storedToken, accountId)
      }
    }
    catch {
      // Redis unavailable — non-fatal
    }
  },

  /**
   * Refreshes the token pair using a valid refresh token.
   * Mirrors Python `AccountService.refresh_token()`.
   */
  async refreshToken(db: Database, refreshToken: string): Promise<TokenPair> {
    const accountId = await redis.get(`${REFRESH_TOKEN_PREFIX}${refreshToken}`)
    if (!accountId) {
      throw new RefreshTokenNotFoundError('Invalid refresh token')
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    if (!account) {
      throw new RefreshTokenAccountNotFoundError()
    }

    if (account.status === 'banned') {
      throw new AuthError('Account is banned.')
    }

    const newAccessToken = issueAccessToken(account.id)
    const newRefreshToken = randomBytes(64).toString('hex')
    const csrfToken = issueCsrfToken(account.id)

    await accountService.deleteRefreshToken(refreshToken, account.id)
    await accountService.storeRefreshToken(newRefreshToken, account.id)

    return { access_token: newAccessToken, refresh_token: newRefreshToken, csrf_token: csrfToken }
  },

  // ── Refresh token Redis helpers ──────────────────────────────────

  async storeRefreshToken(refreshToken: string, accountId: string) {
    try {
      await redis.setex(`${REFRESH_TOKEN_PREFIX}${refreshToken}`, REFRESH_TOKEN_EXPIRY, accountId)
      await redis.setex(`${ACCOUNT_REFRESH_TOKEN_PREFIX}${accountId}`, REFRESH_TOKEN_EXPIRY, refreshToken)
    }
    catch {
      // Redis unavailable — tokens still work, just cannot be revoked
    }
  },

  async deleteRefreshToken(refreshToken: string, accountId: string) {
    try {
      await redis.del(`${REFRESH_TOKEN_PREFIX}${refreshToken}`)
      await redis.del(`${ACCOUNT_REFRESH_TOKEN_PREFIX}${accountId}`)
    }
    catch {
      // non-fatal
    }
  },

  // ── Login rate limiting ──────────────────────────────────────────

  async isLoginErrorRateLimit(email: string): Promise<boolean> {
    try {
      const count = await redis.get(`${LOGIN_ERROR_RATE_LIMIT_PREFIX}${email}`)
      return count !== null && Number.parseInt(count, 10) >= LOGIN_RATE_LIMIT_MAX
    }
    catch {
      return false
    }
  },

  async addLoginErrorRateLimit(email: string) {
    try {
      const key = `${LOGIN_ERROR_RATE_LIMIT_PREFIX}${email}`
      const count = await redis.get(key)
      if (count === null) {
        await redis.setex(key, LOGIN_RATE_LIMIT_WINDOW, '1')
      }
      else {
        await redis.incr(key)
      }
    }
    catch {
      // non-fatal
    }
  },

  async resetLoginErrorRateLimit(email: string) {
    try {
      await redis.del(`${LOGIN_ERROR_RATE_LIMIT_PREFIX}${email}`)
    }
    catch {
      // non-fatal
    }
  },

  // ── Email register token management ──────────────────────────────

  /**
   * Generates a 6-digit verification code and stores it in Redis.
   * Returns { code, token }.
   */
  async generateEmailRegisterToken(
    email: string,
    additionalData?: Record<string, unknown>,
  ): Promise<{ code: string; token: string }> {
    const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
    const token = randomBytes(32).toString('hex')
    const data = JSON.stringify({ email, code, ...additionalData })

    try {
      await redis.setex(`${EMAIL_REGISTER_TOKEN_PREFIX}${token}`, EMAIL_REGISTER_TOKEN_EXPIRY, data)
    }
    catch {
      // If Redis is down, we still return the token (caller should handle gracefully)
    }

    return { code, token }
  },

  /**
   * Retrieves and validates email register data from Redis.
   */
  async getEmailRegisterData(token: string): Promise<Record<string, unknown> | null> {
    try {
      const data = await redis.get(`${EMAIL_REGISTER_TOKEN_PREFIX}${token}`)
      return data ? JSON.parse(data) as Record<string, unknown> : null
    }
    catch {
      return null
    }
  },

  /**
   * Revokes (deletes) an email register token from Redis.
   */
  async revokeEmailRegisterToken(token: string) {
    try {
      await redis.del(`${EMAIL_REGISTER_TOKEN_PREFIX}${token}`)
    }
    catch {
      // non-fatal
    }
  },

  // ── Email register error rate limiting ───────────────────────────

  async isEmailRegisterErrorRateLimit(email: string): Promise<boolean> {
    try {
      const count = await redis.get(`${EMAIL_REGISTER_ERROR_PREFIX}${email}`)
      return count !== null && Number.parseInt(count, 10) >= EMAIL_REGISTER_ERROR_MAX
    }
    catch {
      return false
    }
  },

  async addEmailRegisterErrorRateLimit(email: string) {
    try {
      const key = `${EMAIL_REGISTER_ERROR_PREFIX}${email}`
      const count = await redis.get(key)
      if (count === null) {
        await redis.setex(key, EMAIL_REGISTER_ERROR_WINDOW, '1')
      }
      else {
        await redis.incr(key)
      }
    }
    catch {
      // non-fatal
    }
  },

  async resetEmailRegisterErrorRateLimit(email: string) {
    try {
      await redis.del(`${EMAIL_REGISTER_ERROR_PREFIX}${email}`)
    }
    catch {
      // non-fatal
    }
  },

  // ── Tenant helpers ───────────────────────────────────────────────

  /**
   * Gets all tenants the account has joined.
   */
  async getJoinTenants(db: Database, accountId: string) {
    return db
      .select({
        id: tenants.id,
        name: tenants.name,
        role: tenantAccountJoins.role,
      })
      .from(tenantAccountJoins)
      .innerJoin(tenants, eq(tenantAccountJoins.tenantId, tenants.id))
      .where(eq(tenantAccountJoins.accountId, accountId))
  },
}
