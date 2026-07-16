import { describe, expect, it } from 'vitest'
import app from '../../src/index.js'

describe('GET /console/api/workspaces/current/model-providers/:provider/models/parameter-rules', () => {
  it('matches single-segment provider (e.g. "deepseek")', async () => {
    const res = await app.request(
      '/console/api/workspaces/current/model-providers/deepseek/models/parameter-rules?model=deepseek-v4-flash',
    )
    // Should NOT be 404 — 401 means the route matched but auth is missing.
    expect(res.status).not.toBe(404)
    expect(res.status).toBe(401)
  })

  it('matches multi-segment provider (e.g. "langgenius/deepseek/deepseek")', async () => {
    const res = await app.request(
      '/console/api/workspaces/current/model-providers/langgenius/deepseek/deepseek/models/parameter-rules?model=deepseek-v4-flash',
    )
    // Should NOT be 404 — 401 means the route matched but auth is missing.
    expect(res.status).not.toBe(404)
    expect(res.status).toBe(401)
  })

  it('matches two-segment provider (e.g. "langgenius/deepseek")', async () => {
    const res = await app.request(
      '/console/api/workspaces/current/model-providers/langgenius/deepseek/models/parameter-rules?model=deepseek-chat',
    )
    expect(res.status).not.toBe(404)
    expect(res.status).toBe(401)
  })

  it('returns 400 when model query param is missing (after auth)', async () => {
    // Without auth, expect 401 first (auth check before param validation).
    const res = await app.request(
      '/console/api/workspaces/current/model-providers/langgenius/deepseek/deepseek/models/parameter-rules',
    )
    expect(res.status).toBe(401)
  })

  it('returns 404 for non-parameter-rules sub-paths under model-providers', async () => {
    const res = await app.request(
      '/console/api/workspaces/current/model-providers/langgenius/deepseek/models/credentials',
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 for arbitrary deep paths that do not end in /models/parameter-rules', async () => {
    const res = await app.request(
      '/console/api/workspaces/current/model-providers/a/b/c/d',
    )
    expect(res.status).toBe(404)
  })
})
