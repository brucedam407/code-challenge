import { describe, expect, it } from 'vitest'
import { createDb } from '../../src/db/index.js'
import { HttpError } from '../../src/lib/errors.js'
import { UserRepository } from '../../src/modules/users/user.repository.js'

const base = { role: 'admin', status: 'active' } as const

describe('UserRepository', () => {
  // A handler checks for a duplicate email first, so only a direct insert can
  // reach the unique index - and the 409 depends on reading SQLite's own error
  // code, which no route-level test would notice going stale.
  it('turns a unique violation into a 409, not a 500', () => {
    const db = createDb(':memory:')
    const users = new UserRepository(db)
    const record = { ...base, name: 'Ada', email: 'ada@example.com', createdAt: iso() }

    users.insert({ ...record, id: '11111111-1111-4111-8111-111111111111' })

    try {
      users.insert({ ...record, id: '22222222-2222-4222-8222-222222222222' })
      expect.unreachable('the second insert should have violated the unique index')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(409)
    } finally {
      db.close()
    }
  })
})

function iso() {
  return new Date().toISOString()
}
