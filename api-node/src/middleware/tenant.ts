/**
 * Tenant resolution middleware.
 *
 * After `requireAuth` sets `accountId`, this middleware resolves the user's
 * current tenant (workspace) by looking up `tenant_account_joins.current = true`.
 *
 * Sets `tenantId` and `tenantRole` on the Hono context for downstream handlers.
 */

import { and, eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { tenantAccountJoins, tenants } from '../db/schema.js'
import { AuthError } from '../lib/errors.js'
import type { AppEnv } from '../types/hono-env.js'

export const resolveTenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const accountId = c.get('accountId')
  if (!accountId) {
    throw new AuthError('Authentication required.')
  }

  const db = c.get('db')

  const [row] = await db
    .select({
      tenantId: tenants.id,
      tenantStatus: tenants.status,
      role: tenantAccountJoins.role,
    })
    .from(tenantAccountJoins)
    .innerJoin(tenants, eq(tenantAccountJoins.tenantId, tenants.id))
    .where(
      and(
        eq(tenantAccountJoins.accountId, accountId),
        eq(tenantAccountJoins.current, true),
      ),
    )
    .limit(1)

  if (!row) {
    throw new AuthError('No current workspace found.')
  }

  c.set('tenantId', row.tenantId)
  c.set('tenantRole', row.role)

  await next()
}
