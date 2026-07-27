// Generated from openapi.yaml — fill in seeds and assertions.
// Run `pnpm test:generate` to add stubs for new routes.
// Both test users are pre-seeded: use testOtherUserId for cross-user permission tests.
import { describe, it, expect } from 'vitest'
import { buildTestApp, asAuth, validateResponse, testUserId } from './helpers'

const app = buildTestApp()

describe('createTextAssist', () => {
  it('requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/text-assist' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /text-assist — enhance capitalizes and punctuates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/text-assist',
      headers: asAuth(testUserId),
      payload: { text: 'fixed the bug', mode: 'enhance' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('createTextAssist', 200, res.json())
    expect(res.json().data.result).toBe('Fixed the bug.')
  })

  it('POST /text-assist — summarize collapses to the first sentence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/text-assist',
      headers: asAuth(testUserId),
      payload: { text: 'Reviewed the onboarding flow end to end. Left comments on three PRs. Blocked on design sign-off.', mode: 'summarize' },
    })
    expect(res.statusCode).toBe(200)
    await validateResponse('createTextAssist', 200, res.json())
    expect(res.json().data.result).toBe('Reviewed the onboarding flow end to end.')
  })
})
