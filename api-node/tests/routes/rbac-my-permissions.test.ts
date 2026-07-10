/**
 * Route-level tests for GET /console/api/workspaces/current/rbac/my-permissions.
 *
 * Validates authentication guard and 401 behavior.
 * Full service logic is covered in unit/services/rbac-permissions.test.ts.
 */

import { describe, expect, it } from 'vitest'
import app from '../../src/index.js'

const BASE = '/console/api/workspaces/current/rbac/my-permissions'

describe('GET /console/api/workspaces/current/rbac/my-permissions', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.request(BASE, { method: 'GET' })
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.code).toBe('unauthorized')
  })

  it('returns 401 with invalid Bearer token', async () => {
    const res = await app.request(BASE, {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.code).toBe('unauthorized')
  })

  it('returns 401 with malformed Authorization header', async () => {
    const res = await app.request(BASE, {
      method: 'GET',
      headers: { Authorization: 'NotBearer some-token' },
    })
    expect(res.status).toBe(401)
  })

  it('rejects POST requests (only GET is supported)', async () => {
    const res = await app.request(BASE, { method: 'POST' })
    // Should return 401 (auth check runs before method check) or 404/405
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
