import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../../../types/hono-env.js'
import { requireAuth } from '../../../middleware/auth.js'
import { accounts, difySetups } from '../../../db/schema.js'
import {
  AccountNotInitializedError,
  NotInitValidateError,
  NotSetupError,
} from '../../../lib/errors.js'
import { config } from '../../../config/index.js'

const profileRoute = new Hono<AppEnv>()

/**
 * GET /account/profile — returns the current user's profile.
 * Mirrors Python AccountProfileApi with setup_required + login_required
 * + account_initialization_required decorators.
 *
 * Headers x-version and x-env match what the web frontend expects
 * (see web/features/account-profile/client.ts).
 */
profileRoute.get(
  '/account/profile',
  requireAuth,
  async (c) => {
    const db = c.get('db')
    const accountId = c.get('accountId') as string

    // ── setup_required (mirrors Python wraps.py setup_required) ──
    // For SELF_HOSTED edition, check that dify_setups has at least one row.
    const [setupRow] = await db
      .select({ version: difySetups.version })
      .from(difySetups)
      .limit(1)

    if (!setupRow) {
      // INIT_PASSWORD env var → NotInitValidateError, otherwise NotSetupError
      if (process.env.INIT_PASSWORD) {
        throw new NotInitValidateError()
      }
      throw new NotSetupError()
    }

    // ── Fetch the current account ──
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1)

    if (!account) {
      return c.json({ code: 'unauthorized', message: 'Account not found.' }, 401)
    }

    // ── account_initialization_required ──
    // Python: AccountStatus.UNINITIALIZED → AccountNotInitializedError
    if (account.status === 'pending' && !account.initializedAt) {
      throw new AccountNotInitializedError()
    }

    // ── Build response (mirrors Python AccountResponse) ──
    const toTimestamp = (d: Date | null | undefined): number | null =>
      d ? Math.floor(d.getTime() / 1000) : null

    const responseBody = {
      id: account.id,
      name: account.name,
      email: account.email,
      is_password_set: Boolean(account.password),
      avatar: account.avatar ?? null,
      avatar_url: null, // avatar URL resolution deferred; client handles this
      interface_language: account.interfaceLanguage ?? null,
      interface_theme: account.interfaceTheme ?? null,
      timezone: account.timezone ?? null,
      last_login_at: toTimestamp(account.lastLoginAt),
      last_login_ip: account.lastLoginIp ?? null,
      created_at: toTimestamp(account.createdAt),
    }

    return c.json(responseBody, 200, {
      'x-version': config.appVersion,
      'x-env': config.isProd ? 'PRODUCTION' : 'DEVELOPMENT',
    })
  },
)

export { profileRoute }
