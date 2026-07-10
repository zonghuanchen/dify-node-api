/**
 * Workspace service — mirrors Python api/services/workspace_service.py.
 *
 * Provides tenant (workspace) information for authenticated users.
 */

import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { tenantAccountJoins, tenants } from '../db/schema.js'
import { AccountNotLinkTenantError } from '../lib/errors.js'

// ── Response types ─────────────────────────────────────────────────

export interface WorkspaceCustomConfig {
  remove_webapp_brand: boolean | null
  replace_webapp_logo: string | null
}

/**
 * Mirrors Python TenantInfoResponse from workspace.py.
 * Fields that require billing/enterprise services return null
 * when those services are not available (self-hosted mode).
 */
export interface TenantInfoResponse {
  id: string
  name: string | null
  plan: string | null
  status: string | null
  created_at: number | null
  role: string | null
  in_trial: boolean | null
  trial_end_reason: string | null
  custom_config: WorkspaceCustomConfig | null
  trial_credits: number | null
  trial_credits_used: number | null
  next_credit_reset_date: number | null
}

/**
 * Converts a Date to a unix timestamp in seconds.
 * Mirrors Python `to_timestamp()`.
 */
function toTimestamp(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor(date.getTime() / 1000)
}

// ── Service ────────────────────────────────────────────────────────

export const workspaceService = {
  /**
   * Get all workspaces for an account.
   * Returns (tenant, membership) pairs where tenant.status === 'normal'.
   * Mirrors Python `TenantService.get_workspaces_for_account()`.
   */
  async getWorkspacesForAccount(db: Database, accountId: string, currentTenantId: string) {
    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        status: tenants.status,
        createdAt: tenants.createdAt,
        lastOpenedAt: tenantAccountJoins.lastOpenedAt,
      })
      .from(tenantAccountJoins)
      .innerJoin(tenants, eq(tenantAccountJoins.tenantId, tenants.id))
      .where(
        and(
          eq(tenantAccountJoins.accountId, accountId),
          eq(tenants.status, 'normal'),
        ),
      )

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      created_at: toTimestamp(row.createdAt),
      last_opened_at: toTimestamp(row.lastOpenedAt),
      plan: 'sandbox', // self-hosted default; SaaS/enterprise would override
      current: row.id === currentTenantId,
    }))
  },
  /**
   * Get the current tenant for an account.
   * Returns the tenant record where tenant_account_joins.current = true.
   */
  async getCurrentTenant(db: Database, accountId: string) {
    const [row] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        plan: tenants.plan,
        status: tenants.status,
        customConfig: tenants.customConfig,
        createdAt: tenants.createdAt,
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

    return row ?? null
  },

  /**
   * Get all active (non-archived) tenants for an account.
   * Used for auto-switching when the current tenant is archived.
   */
  async getActiveTenants(db: Database, accountId: string) {
    return db
      .select({
        id: tenants.id,
        name: tenants.name,
        plan: tenants.plan,
        status: tenants.status,
        customConfig: tenants.customConfig,
        createdAt: tenants.createdAt,
        role: tenantAccountJoins.role,
      })
      .from(tenantAccountJoins)
      .innerJoin(tenants, eq(tenantAccountJoins.tenantId, tenants.id))
      .where(
        and(
          eq(tenantAccountJoins.accountId, accountId),
          eq(tenants.status, 'normal'),
        ),
      )
  },

  /**
   * Switch the current workspace for an account.
   * Mirrors Python `TenantService.switch_tenant()`:
   * - Sets current=false for all other joins
   * - Sets current=true and last_opened_at for the target tenant
   */
  async switchTenant(db: Database, accountId: string, tenantId: string) {
    // Verify the account is a member of the target tenant
    const [join] = await db
      .select()
      .from(tenantAccountJoins)
      .innerJoin(tenants, eq(tenantAccountJoins.tenantId, tenants.id))
      .where(
        and(
          eq(tenantAccountJoins.accountId, accountId),
          eq(tenantAccountJoins.tenantId, tenantId),
          eq(tenants.status, 'normal'),
        ),
      )
      .limit(1)

    if (!join) {
      throw new AccountNotLinkTenantError('Account not linked to this workspace or workspace is archived.')
    }

    // Set current=false for all other tenants
    await db
      .update(tenantAccountJoins)
      .set({ current: false })
      .where(
        and(
          eq(tenantAccountJoins.accountId, accountId),
          ne(tenantAccountJoins.tenantId, tenantId),
        ),
      )

    // Set current=true for the target tenant
    await db
      .update(tenantAccountJoins)
      .set({ current: true, lastOpenedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(tenantAccountJoins.accountId, accountId),
          eq(tenantAccountJoins.tenantId, tenantId),
        ),
      )
  },

  /**
   * Build the TenantInfoResponse for a given tenant.
   * Mirrors Python `WorkspaceService.get_tenant_info()`.
   *
   * Notes:
   * - `custom_config` requires FeatureService.get_features (not yet implemented) -> null
   * - `in_trial`, `trial_end_reason` require enterprise/billing -> null
   * - `trial_credits`, `trial_credits_used`, `next_credit_reset_date` require CLOUD edition -> null
   */
  async getTenantInfo(db: Database, tenantId: string, accountId: string): Promise<TenantInfoResponse> {
    // Load tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`)
    }

    // Load user's role in this tenant
    const [join] = await db
      .select({ role: tenantAccountJoins.role })
      .from(tenantAccountJoins)
      .where(
        and(
          eq(tenantAccountJoins.tenantId, tenantId),
          eq(tenantAccountJoins.accountId, accountId),
        ),
      )
      .limit(1)

    return {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      created_at: toTimestamp(tenant.createdAt),
      role: join?.role ?? 'normal',
      in_trial: null,
      trial_end_reason: null,
      custom_config: null,
      trial_credits: null,
      trial_credits_used: null,
      next_credit_reset_date: null,
    }
  },
}
