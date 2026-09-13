import { HttpError } from '../../lib/errors.js'
import type { UserRepository } from './user.repository.js'
import type { User } from './user.types.js'

/** The two checks more than one handler needs. */

export function requireUser(users: UserRepository, id: string): User {
  const user = users.findById(id)
  if (!user) throw HttpError.notFound(`No user with id ${id}`)
  return user
}

export function assertEmailFree(users: UserRepository, email: string, exceptId?: string): void {
  const existing = users.findByEmail(email)
  if (existing && existing.id !== exceptId) {
    throw HttpError.conflict(`Email ${email} is already registered`, { field: 'email' })
  }
}
