import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { errorHandler } from '../../src/middleware/error-handler.js'
import { rateLimit } from '../../src/middleware/rate-limit.js'

/** An app that is nothing but the limiter, with a clock the test drives. */
function appWith(limit: number, windowMs: number, clock: { at: number }) {
  const app = express()
  app.post('/', rateLimit({ limit, windowMs, now: () => clock.at }), (_req, res) => {
    res.status(201).end()
  })
  app.use(errorHandler)
  return app
}

describe('rateLimit', () => {
  it('allows the limit, then answers 429', async () => {
    const clock = { at: 0 }
    const api = request(appWith(2, 60_000, clock))

    await api.post('/').expect(201)
    await api.post('/').expect(201)

    const blocked = await api.post('/').expect(429)
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS')
    expect(blocked.body.error.message).toContain('2 requests per 60s')
  })

  it('says how much is left, and when to come back', async () => {
    const clock = { at: 0 }
    const api = request(appWith(2, 60_000, clock))

    const first = await api.post('/').expect(201)
    expect(first.headers['ratelimit-limit']).toBe('2')
    expect(first.headers['ratelimit-remaining']).toBe('1')
    expect(first.headers['ratelimit-reset']).toBe('60')

    await api.post('/')
    const blocked = await api.post('/').expect(429)
    expect(blocked.headers['ratelimit-remaining']).toBe('0')
    expect(blocked.headers['retry-after']).toBe('60')
  })

  it('lets the client through again once the window rolls over', async () => {
    const clock = { at: 0 }
    const api = request(appWith(1, 60_000, clock))

    await api.post('/').expect(201)
    await api.post('/').expect(429)

    clock.at += 59_000
    await api.post('/').expect(429)

    clock.at += 2_000
    await api.post('/').expect(201)
  })

  it('counts each client separately', async () => {
    const clock = { at: 0 }
    const app = appWith(1, 60_000, clock)

    // supertest speaks to the app over a real socket, so both requests carry
    // the same address; X-Forwarded-For only counts once a proxy is trusted.
    app.set('trust proxy', true)
    await request(app).post('/').set('X-Forwarded-For', '10.0.0.1').expect(201)
    await request(app).post('/').set('X-Forwarded-For', '10.0.0.2').expect(201)
    await request(app).post('/').set('X-Forwarded-For', '10.0.0.1').expect(429)
  })

  it('forgets clients whose window has passed', async () => {
    const clock = { at: 0 }
    const api = request(appWith(1, 1_000, clock))

    for (let round = 0; round < 100; round++) {
      await api.post('/').expect(201)
      clock.at += 2_000
    }
  })
})
