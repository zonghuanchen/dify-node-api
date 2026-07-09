import { describe, expect, it } from 'vitest'
import app from '../../src/index.js'

describe('POST /console/api/workspaces/current', () => {
  it('returns 401 without authentication', async () => {
    const res = await app.request('/console/api/workspaces/current', {
      method: 'POST',
    })
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.code).toBe('unauthorized')
  })

  it('returns 401 with invalid Bearer token', async () => {
    const res = await app.request('/console/api/workspaces/current', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token-here',
      },
    })
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.code).toBe('unauthorized')
  })

  it('returns 401 with malformed Authorization header', async () => {
    const res = await app.request('/console/api/workspaces/current', {
      method: 'POST',
      headers: {
        Authorization: 'NotBearer some-token',
      },
    })
    expect(res.status).toBe(401)
  })

  it('rejects GET requests (only POST is supported)', async () => {
    const res = await app.request('/console/api/workspaces/current', {
      method: 'GET',
    })
    // Should return 404 (route not found for GET) or 405
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
