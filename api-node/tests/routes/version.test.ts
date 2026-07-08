import { describe, expect, it } from 'vitest'
import app from '../../src/index.js'

describe('GET /console/api/version', () => {
  it('returns version string', async () => {
    const res = await app.request('/console/api/version')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.version).toBeDefined()
    expect(typeof body.version).toBe('string')
  })
})
