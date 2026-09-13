import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createHarness } from '../helpers.js'

const { api, db, createUser, close } = createHarness()

afterAll(close)
beforeEach(() => db.exec('DELETE FROM users'))

describe('updateUserHandler', () => {
  it('updates only the fields provided and moves updatedAt', async () => {
    const created = await createUser()
    const response = await api()
      .patch(`/api/users/${created.id}`)
      .send({ status: 'suspended' })
      .expect(200)

    expect(response.body.data).toMatchObject({ name: created.name, status: 'suspended' })
    expect(response.body.data.createdAt).toBe(created.createdAt)
    expect(new Date(response.body.data.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    )
  })

  it('lets a user keep their own email', async () => {
    const created = await createUser()
    await api()
      .patch(`/api/users/${created.id}`)
      .send({ email: created.email, name: 'Ada L.' })
      .expect(200)
  })

  it('refuses an email that belongs to somebody else', async () => {
    const ada = await createUser()
    await createUser({ email: 'grace@example.com' })

    await api().patch(`/api/users/${ada.id}`).send({ email: 'grace@example.com' }).expect(409)
  })

  it('rejects an empty body', async () => {
    const created = await createUser()
    const response = await api().patch(`/api/users/${created.id}`).send({}).expect(422)

    expect(response.body.error.details.issues[0].message).toContain('at least one field')
  })

  it('answers 404 for an unknown id', async () => {
    await api()
      .patch('/api/users/11111111-1111-4111-8111-111111111111')
      .send({ name: 'Ghost' })
      .expect(404)
  })
})
