import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createHarness } from '../helpers.js'

const { api, close } = createHarness()

const people = [
  { name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin', status: 'active' },
  { name: 'Grace Hopper', email: 'grace@example.com', role: 'admin', status: 'inactive' },
  { name: 'Alan Turing', email: 'alan@shop.dev', role: 'member', status: 'active' },
  { name: 'Barbara Liskov', email: 'barbara@example.com', role: 'member', status: 'suspended' },
  { name: 'Linus Torvalds', email: 'linus@shop.dev', role: 'guest', status: 'active' },
]

beforeAll(async () => {
  for (const person of people) {
    await api().post('/api/users').send(person).expect(201)
  }
})
afterAll(close)

const names = (body: { data: Array<{ name: string }> }) => body.data.map((user) => user.name)

describe('listUsersHandler', () => {
  it('returns every user with pagination metadata', async () => {
    const response = await api().get('/api/users').expect(200)

    expect(response.body.data).toHaveLength(5)
    expect(response.body.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 5,
      totalPages: 1,
      hasNext: false,
    })
  })

  it('filters by role', async () => {
    const response = await api().get('/api/users?role=admin').expect(200)
    expect(names(response.body).sort()).toEqual(['Ada Lovelace', 'Grace Hopper'])
  })

  it('filters by status', async () => {
    const response = await api().get('/api/users?status=suspended').expect(200)
    expect(names(response.body)).toEqual(['Barbara Liskov'])
  })

  it('combines filters', async () => {
    const response = await api().get('/api/users?role=member&status=active').expect(200)
    expect(names(response.body)).toEqual(['Alan Turing'])
  })

  it('searches name and email, case-insensitively', async () => {
    const byName = await api().get('/api/users?q=LOVE').expect(200)
    expect(names(byName.body)).toEqual(['Ada Lovelace'])

    const byEmail = await api().get('/api/users?q=shop.dev').expect(200)
    expect(names(byEmail.body).sort()).toEqual(['Alan Turing', 'Linus Torvalds'])
  })

  it('treats % in a search term as a literal, not a wildcard', async () => {
    const response = await api().get('/api/users?q=%25').expect(200)
    expect(response.body.data).toHaveLength(0)
  })

  it('sorts by a chosen field and direction', async () => {
    const response = await api().get('/api/users?sort=name&order=asc').expect(200)
    expect(names(response.body)).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Barbara Liskov',
      'Grace Hopper',
      'Linus Torvalds',
    ])
  })

  it('paginates, and the pages do not overlap', async () => {
    const first = await api().get('/api/users?sort=name&order=asc&limit=2&page=1').expect(200)
    const second = await api().get('/api/users?sort=name&order=asc&limit=2&page=2').expect(200)
    const third = await api().get('/api/users?sort=name&order=asc&limit=2&page=3').expect(200)

    expect(names(first.body)).toEqual(['Ada Lovelace', 'Alan Turing'])
    expect(names(second.body)).toEqual(['Barbara Liskov', 'Grace Hopper'])
    expect(names(third.body)).toEqual(['Linus Torvalds'])
    expect(first.body.meta.pagination).toMatchObject({ total: 5, totalPages: 3, hasNext: true })
    expect(third.body.meta.pagination.hasNext).toBe(false)
  })

  it('returns an empty page past the end rather than an error', async () => {
    const response = await api().get('/api/users?page=99').expect(200)
    expect(response.body.data).toEqual([])
    expect(response.body.meta.pagination.total).toBe(5)
  })

  it('filters by creation window', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const empty = await api().get(`/api/users?createdAfter=${future}`).expect(200)
    expect(empty.body.data).toHaveLength(0)

    const past = new Date(Date.now() - 60_000).toISOString()
    const all = await api().get(`/api/users?createdAfter=${past}`).expect(200)
    expect(all.body.data).toHaveLength(5)
  })

  it('rejects an inverted creation window', async () => {
    const response = await api()
      .get(
        '/api/users?createdAfter=2025-01-02T00:00:00.000Z&createdBefore=2025-01-01T00:00:00.000Z',
      )
      .expect(400)

    expect(response.body.error.message).toContain('createdAfter')
  })

  it('rejects an unknown filter instead of silently ignoring it', async () => {
    const response = await api().get('/api/users?nope=admin').expect(422)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a bad enum value, a bad page and an oversized limit', async () => {
    await api().get('/api/users?role=wizard').expect(422)
    await api().get('/api/users?page=0').expect(422)
    await api().get('/api/users?limit=10000').expect(422)
  })

  // Limits are arguments, not import-time config: two apps, two caps.
  it('enforces the page cap its app was built with', async () => {
    const strict = createHarness({ maxPageSize: 2 })
    try {
      await request(strict.app).get('/api/users?limit=2').expect(200)
      await request(strict.app).get('/api/users?limit=3').expect(422)
      // This suite keeps the default cap.
      await api().get('/api/users?limit=3').expect(200)
    } finally {
      strict.close()
    }
  })
})
