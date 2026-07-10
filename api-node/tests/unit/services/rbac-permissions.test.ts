/**
 * Unit tests for legacy RBAC permission constants and mapping.
 *
 * Validates that the permission key lists mirror the Python source
 * in api/services/enterprise/rbac_service.py L305–L527.
 */

import { describe, expect, it } from 'vitest'
import { LEGACY_MY_PERMISSIONS, VALID_TENANT_ROLES } from '../../../src/lib/rbac-permissions.js'

describe('LEGACY_MY_PERMISSIONS mapping', () => {
  it('contains all five tenant roles', () => {
    const roles = Object.keys(LEGACY_MY_PERMISSIONS)
    expect(roles).toEqual(['owner', 'admin', 'editor', 'normal', 'dataset_operator'])
  })

  it('VALID_TENANT_ROLES matches mapping keys', () => {
    expect(VALID_TENANT_ROLES.size).toBe(5)
    for (const role of Object.keys(LEGACY_MY_PERMISSIONS)) {
      expect(VALID_TENANT_ROLES.has(role)).toBe(true)
    }
  })

  describe('owner role', () => {
    it('has workspace, app, and dataset keys', () => {
      const perms = LEGACY_MY_PERMISSIONS.owner
      expect(perms.workspace.length).toBeGreaterThan(0)
      expect(perms.app!.length).toBeGreaterThan(0)
      expect(perms.dataset!.length).toBeGreaterThan(0)
    })

    it('workspace keys include core management permissions', () => {
      const keys = LEGACY_MY_PERMISSIONS.owner.workspace
      expect(keys).toContain('workspace.member.manage')
      expect(keys).toContain('workspace.role.manage')
      expect(keys).toContain('plugin.install')
      expect(keys).toContain('mcp.manage')
    })

    it('app keys include full ACL permissions', () => {
      const keys = LEGACY_MY_PERMISSIONS.owner.app!
      expect(keys).toContain('app.acl.preview')
      expect(keys).toContain('app.acl.edit')
      expect(keys).toContain('app.acl.delete')
      expect(keys).toContain('app.acl.tracing_config')
    })

    it('dataset keys include full ACL and API key management', () => {
      const keys = LEGACY_MY_PERMISSIONS.owner.dataset!
      expect(keys).toContain('dataset.acl.preview')
      expect(keys).toContain('dataset.acl.delete')
      expect(keys).toContain('dataset.api_key.manage')
    })
  })

  describe('normal role', () => {
    it('has workspace and app keys but no dataset keys', () => {
      const perms = LEGACY_MY_PERMISSIONS.normal
      expect(perms.workspace.length).toBeGreaterThan(0)
      expect(perms.app!.length).toBeGreaterThan(0)
      expect(perms.dataset).toBeUndefined()
    })

    it('app keys are limited to monitor only', () => {
      const keys = LEGACY_MY_PERMISSIONS.normal.app!
      expect(keys).toEqual(['app.acl.monitor'])
    })
  })

  describe('dataset_operator role', () => {
    it('has workspace and dataset keys but no app keys', () => {
      const perms = LEGACY_MY_PERMISSIONS.dataset_operator
      expect(perms.workspace.length).toBeGreaterThan(0)
      expect(perms.app).toBeUndefined()
      expect(perms.dataset!.length).toBeGreaterThan(0)
    })

    it('workspace keys are limited to plugin + dataset ops', () => {
      const keys = LEGACY_MY_PERMISSIONS.dataset_operator.workspace
      expect(keys).toContain('plugin.install')
      expect(keys).toContain('dataset.create_and_management')
      expect(keys).not.toContain('workspace.member.manage')
    })
  })

  describe('editor role', () => {
    it('has all three resource types', () => {
      const perms = LEGACY_MY_PERMISSIONS.editor
      expect(perms.workspace.length).toBeGreaterThan(0)
      expect(perms.app!.length).toBeGreaterThan(0)
      expect(perms.dataset!.length).toBeGreaterThan(0)
    })

    it('does not include workspace member/role management', () => {
      const keys = LEGACY_MY_PERMISSIONS.editor.workspace
      expect(keys).not.toContain('workspace.member.manage')
      expect(keys).not.toContain('workspace.role.manage')
    })
  })

  describe('admin role', () => {
    it('has workspace member management', () => {
      const keys = LEGACY_MY_PERMISSIONS.admin.workspace
      expect(keys).toContain('workspace.member.manage')
      expect(keys).toContain('workspace.role.manage')
    })
  })
})
