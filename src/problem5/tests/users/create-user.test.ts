import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createHarness, validUser } from '../helpers.js'

const { api, db, createUser, close } = createHarness()

afterAll(close)
beforeEach(() => db.exec('DELETE FROM users'))

describe('createUserHandler', () => {
  it('creates a user and returns it with an id and timestamps', async () => {
    const response = await api().post('/api/users').send(validUser).expect(201)

    expect(response.body.data).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'admin',
      status: 'active',
    })
    expect(response.body.data.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.body.data.createdAt).toBe(response.body.data.updatedAt)
    expect(response.headers.location).toBe(`/api/users/${response.body.data.id}`)
  })

  it('defaults role and status when they are omitted', async () => {
    const response = await api()
      .post('/api/users')
      .send({ name: 'Alan Turing', email: 'alan@example.com' })
      .expect(201)

    expect(response.body.data).toMatchObject({ role: 'member', status: 'active' })
  })

  it('trims the name and lowercases the email', async () => {
    const user = await createUser({ name: '  Grace Hopper  ', email: 'GRACE@Example.COM' })
    expect(user.name).toBe('Grace Hopper')
    expect(user.email).toBe('grace@example.com')
  })

  it('refuses a duplicate email with 409, case-insensitively', async () => {
    await createUser()
    const response = await api()
      .post('/api/users')
      .send({ ...validUser, email: 'ADA@example.com' })
      .expect(409)

    expect(response.body.error.code).toBe('CONFLICT')
  })

  it('rejects a malformed email with 422 and says which field', async () => {
    const response = await api()
      .post('/api/users')
      .send({ name: 'Nope', email: 'not-an-email' })
      .expect(422)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.error.details.issues[0].path).toBe('email')
  })

  it('rejects unknown fields rather than ignoring them', async () => {
    const response = await api()
      .post('/api/users')
      .send({ ...validUser, isAdmin: true })
      .expect(422)

    expect(response.body.error.details.issues[0].code).toBe('unrecognized_keys')
  })

  it('answers 400 for a body that is not JSON', async () => {
    const response = await api()
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400)

    expect(response.body.error.code).toBe('BAD_REQUEST')
  })
})

describe('createUserHandler, rate limited', () => {
  it('stops a client creating more than its share, and says when to retry', async () => {
    const limited = createHarness({ createRateLimit: 2, createRateWindowMs: 60_000 })
    const api = () => request(limited.app)

    try {
      await api().post('/api/users').send({ name: 'One', email: 'one@example.com' }).expect(201)
      await api().post('/api/users').send({ name: 'Two', email: 'two@example.com' }).expect(201)

      const blocked = await api()
        .post('/api/users')
        .send({ name: 'Three', email: 'three@example.com' })
        .expect(429)

      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS')
      expect(blocked.headers['retry-after']).toBe('60')

      // Reading is not what the limit is there for.
      await api().get('/api/users').expect(200)
      // And the third user was never created.
      const list = await api().get('/api/users').expect(200)
      expect(list.body.meta.pagination.total).toBe(2)
    } finally {
      limited.close()
    }
  })
})
