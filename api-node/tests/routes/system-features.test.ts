import { describe, expect, it } from 'vitest'
import app from '../../src/index.js'

describe('GET /console/api/system-features', () => {
  it('returns 200 without authentication', async () => {
    const res = await app.request('/console/api/system-features')
    expect(res.status).toBe(200)
  })

  it('returns correct response shape', async () => {
    const res = await app.request('/console/api/system-features')
    const body = await res.json()

    // Top-level boolean flags
    expect(typeof body.enable_app_deploy).toBe('boolean')
    expect(typeof body.sso_enforced_for_signin).toBe('boolean')
    expect(typeof body.enable_marketplace).toBe('boolean')
    expect(typeof body.enable_email_code_login).toBe('boolean')
    expect(typeof body.enable_email_password_login).toBe('boolean')
    expect(typeof body.enable_social_oauth_login).toBe('boolean')
    expect(typeof body.enable_collaboration_mode).toBe('boolean')
    expect(typeof body.is_allow_register).toBe('boolean')
    expect(typeof body.is_allow_create_workspace).toBe('boolean')
    expect(typeof body.is_email_setup).toBe('boolean')
    expect(typeof body.enable_change_email).toBe('boolean')
    expect(typeof body.enable_creators_platform).toBe('boolean')
    expect(typeof body.enable_trial_app).toBe('boolean')
    expect(typeof body.enable_explore_banner).toBe('boolean')
    expect(typeof body.enable_learn_app).toBe('boolean')
    expect(typeof body.rbac_enabled).toBe('boolean')

    // String fields
    expect(typeof body.sso_enforced_for_signin_protocol).toBe('string')
    expect(typeof body.max_plugin_package_size).toBe('number')

    // Nested objects
    expect(body.license).toBeDefined()
    expect(typeof body.license.status).toBe('string')
    expect(typeof body.license.expired_at).toBe('string')
    expect(body.license.workspaces).toBeDefined()
    expect(typeof body.license.workspaces.enabled).toBe('boolean')
    expect(typeof body.license.workspaces.size).toBe('number')
    expect(typeof body.license.workspaces.limit).toBe('number')

    expect(body.branding).toBeDefined()
    expect(typeof body.branding.enabled).toBe('boolean')
    expect(typeof body.branding.application_title).toBe('string')
    expect(typeof body.branding.login_page_logo).toBe('string')
    expect(typeof body.branding.workspace_logo).toBe('string')
    expect(typeof body.branding.favicon).toBe('string')

    expect(body.webapp_auth).toBeDefined()
    expect(typeof body.webapp_auth.enabled).toBe('boolean')
    expect(typeof body.webapp_auth.allow_sso).toBe('boolean')
    expect(body.webapp_auth.sso_config).toBeDefined()
    expect(typeof body.webapp_auth.sso_config.protocol).toBe('string')
    expect(typeof body.webapp_auth.allow_email_code_login).toBe('boolean')
    expect(typeof body.webapp_auth.allow_email_password_login).toBe('boolean')

    expect(body.plugin_installation_permission).toBeDefined()
    expect(typeof body.plugin_installation_permission.plugin_installation_scope).toBe('string')
    expect(typeof body.plugin_installation_permission.restrict_to_marketplace_only).toBe('boolean')

    expect(body.plugin_manager).toBeDefined()
    expect(typeof body.plugin_manager.enabled).toBe('boolean')
  })

  it('returns default values matching Python SystemFeatureModel', async () => {
    const res = await app.request('/console/api/system-features')
    const body = await res.json()

    // Verify key defaults (when ENTERPRISE_ENABLED=false)
    expect(body.enable_app_deploy).toBe(false)
    expect(body.sso_enforced_for_signin).toBe(false)
    expect(body.enable_email_password_login).toBe(true)
    expect(body.enable_collaboration_mode).toBe(true)
    expect(body.is_allow_register).toBe(false)
    expect(body.is_allow_create_workspace).toBe(false)
    expect(body.enable_change_email).toBe(true)
    expect(body.enable_learn_app).toBe(true)
    expect(body.enable_trial_app).toBe(false)
    expect(body.enable_explore_banner).toBe(false)

    // License defaults
    expect(body.license.status).toBe('none')
    expect(body.license.expired_at).toBe('')
    expect(body.license.workspaces.enabled).toBe(false)

    // Branding defaults (enterprise disabled)
    expect(body.branding.enabled).toBe(false)
    expect(body.webapp_auth.enabled).toBe(false)
    expect(body.plugin_manager.enabled).toBe(false)

    // Plugin installation permission defaults
    expect(body.plugin_installation_permission.plugin_installation_scope).toBe('all')
    expect(body.plugin_installation_permission.restrict_to_marketplace_only).toBe(false)
  })

  it('returns marketplace and creators platform enabled by default', async () => {
    const res = await app.request('/console/api/system-features')
    const body = await res.json()

    // These are true by default in Python config
    expect(body.enable_marketplace).toBe(true)
    expect(body.enable_creators_platform).toBe(true)
  })

  it('does not require authentication (unauthenticated by design)', async () => {
    // No Authorization header — should still succeed
    const res = await app.request('/console/api/system-features', {
      headers: {},
    })
    expect(res.status).toBe(200)
  })

  it('gracefully handles invalid Authorization header', async () => {
    const res = await app.request('/console/api/system-features', {
      headers: {
        Authorization: 'Bearer invalid-token-here',
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeDefined()
    expect(body.enable_learn_app).toBe(true)
  })
})
