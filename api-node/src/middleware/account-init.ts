/**
 * Account initialization guard middleware.
 *
 * Mirrors Python `account_initialization_required` decorator in
 * `api/controllers/console/wraps.py`. Checks that the authenticated
 * account has been initialized (status is not 'uninitialized').
 *
 * On auth failure, returns a 401 JSON response directly — mirroring Python
 * `ext_login.py` `unauthorized_handler` instead of throwing.
 */

import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { accounts } from '../db/schema.js'
import { AccountNotInitializedError } from '../lib/errors.js'
import type { AppEnv } from '../types/hono-env.js'

export const requireAccountInitialized: MiddlewareHandler<AppEnv> = async (c, next) => {
  const accountId = c.get('accountId')
  if (!accountId) {
    return c.json({ code: 'unauthorized', message: 'Unauthorized.' }, 401)
  }

  const db = c.get('db')

  const [account] = await db
    .select({ status: accounts.status })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!account || account.status === 'uninitialized') {
    throw new AccountNotInitializedError()
  }

  await next()
}
