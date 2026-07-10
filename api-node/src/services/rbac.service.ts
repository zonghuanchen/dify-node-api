/**
 * RBAC service — mirrors Python api/services/enterprise/rbac_service.py.
 *
 * Provides permission information for authenticated users.
 * When RBAC_ENABLED=false (default), uses legacy role-based permission mapping.
 * When RBAC_ENABLED=true, delegates to the enterprise RBAC inner API (stub for now).
 */

import { and, eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { tenantAccountJoins } from '../db/schema.js'
import { LEGACY_MY_PERMISSIONS, VALID_TENANT_ROLES } from '../lib/rbac-permissions.js'
import { config } from '../config/index.js'

// ── Response types ─────────────────────────────────────────────────

export interface WorkspacePermissionSnapshot {
  permission_keys: string[]
}

export interface ResourcePermissionKeys {
  resource_id: string
  permission_keys: string[]
}

export interface ResourcePermissionSnapshot {
  default_permission_keys: string[]
  overrides: ResourcePermissionKeys[]
}

export interface MyPermissionsResponse {
  workspace: WorkspacePermissionSnapshot
  app: ResourcePermissionSnapshot
  dataset: ResourcePermissionSnapshot
}

// ── Helpers ────────────────────────────────────────────────────────

function emptyResponse(): MyPermissionsResponse {
  return {
    workspace: { permission_keys: [] },
    app: { default_permission_keys: [], overrides: [] },
    dataset: { default_permission_keys: [], overrides: [] },
  }
}

/**
 * Legacy path: resolve permissions from the tenant role using static mapping.
 * Mirrors Python `_legacy_my_permissions()`.
 */
async function legacyMyPermissions(
  db: Database,
  tenantId: string,
  accountId: string | undefined,
): Promise<MyPermissionsResponse> {
  if (!accountId) {
    return emptyResponse()
  }

  const [row] = await db
    .select({ role: tenantAccountJoins.role })
    .from(tenantAccountJoins)
    .where(
      and(
        eq(tenantAccountJoins.tenantId, tenantId),
        eq(tenantAccountJoins.accountId, accountId),
      ),
    )
    .limit(1)

  if (!row || !VALID_TENANT_ROLES.has(row.role)) {
    return emptyResponse()
  }

  const perms = LEGACY_MY_PERMISSIONS[row.role]
  if (!perms) {
    return emptyResponse()
  }

  return {
    workspace: { permission_keys: [...perms.workspace] },
    app: { default_permission_keys: [...(perms.app ?? [])], overrides: [] },
    dataset: { default_permission_keys: [...(perms.dataset ?? [])], overrides: [] },
  }
}

// ── Service ────────────────────────────────────────────────────────

export const rbacService = {
  /**
   * Get the current user's permissions across workspace, app, and dataset.
   *
   * Mirrors Python `RBACService.MyPermissions.get()`.
   *
   * @param db - Database instance
   * @param tenantId - Current workspace/tenant ID
   * @param accountId - Authenticated user's account ID
   * @param appId - Optional app_id filter (used only by enterprise RBAC path)
   * @param datasetId - Optional dataset_id filter (used only by enterprise RBAC path)
   */
  async getMyPermissions(
    db: Database,
    tenantId: string,
    accountId: string,
    appId?: string,
    datasetId?: string,
  ): Promise<MyPermissionsResponse> {
    if (!config.rbacEnabled) {
      return legacyMyPermissions(db, tenantId, accountId)
    }

    // Enterprise RBAC path: delegate to inner RBAC service.
    // TODO: Implement enterprise inner call when RBAC_ENABLED=true.
    // For now, fall back to legacy to avoid breaking the endpoint.
    return legacyMyPermissions(db, tenantId, accountId)
  },
}
