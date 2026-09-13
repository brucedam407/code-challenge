import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createHarness } from '../helpers.js'

const { api, db, createUser, close } = createHarness()

afterAll(close)
beforeEach(() => db.exec('DELETE FROM users'))

describe('deleteUserHandler', () => {
  it('deletes the user and answers 204 with no body', async () => {
    const created = await createUser()
    const response = await api().delete(`/api/users/${created.id}`).expect(204)

    expect(response.body).toEqual({})
    await api().get(`/api/users/${created.id}`).expect(404)
  })

  it('answers 404 when deleting twice', async () => {
    const created = await createUser()
    await api().delete(`/api/users/${created.id}`).expect(204)
    await api().delete(`/api/users/${created.id}`).expect(404)
  })
})
