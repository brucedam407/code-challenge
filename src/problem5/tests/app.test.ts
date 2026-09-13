import { afterAll, describe, expect, it } from 'vitest'
import { createHarness } from './helpers.js'

const { api, close } = createHarness()

afterAll(close)

describe('the app itself', () => {
  it('answers 404 in the same envelope for an unknown route', async () => {
    const response = await api().get('/api/nope').expect(404)
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND')
  })

  it('reports health', async () => {
    const response = await api().get('/health').expect(200)
    expect(response.body).toMatchObject({ status: 'ok' })
  })

  it('echoes a request id', async () => {
    const response = await api().get('/health').expect(200)
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('answers 413 rather than 500 for an oversized body', async () => {
    const response = await api()
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(200_000), email: 'big@example.com' }))
      .expect(413)

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE')
    // A deliberate answer is not a defect: no stack for the client.
    expect(response.body.error.stack).toBeUndefined()
  })
})
