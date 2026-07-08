import { describe, expect, it } from 'vitest'
import app from '../../src/index.js'

describe('GET /console/api/ping', () => {
  it('returns pong with status and timestamp', async () => {
    const res = await app.request('/console/api/ping')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
    expect(typeof body.timestamp).toBe('string')
  })
})
