import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createHarness } from '../helpers.js'

const { api, db, createUser, close } = createHarness()

afterAll(close)
beforeEach(() => db.exec('DELETE FROM users'))

describe('getUserHandler', () => {
  it('returns the user', async () => {
    const created = await createUser()
    const response = await api().get(`/api/users/${created.id}`).expect(200)

    expect(response.body.data).toMatchObject({
      id: created.id,
      name: created.name,
      email: created.email,
    })
  })

  it('answers 404 for an id that does not exist', async () => {
    const response = await api().get('/api/users/11111111-1111-4111-8111-111111111111').expect(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('answers 422 for an id that is not a UUID', async () => {
    await api().get('/api/users/not-a-uuid').expect(422)
  })
})
