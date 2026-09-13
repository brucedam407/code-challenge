import { requireUser } from '../user.guards.js'
import type { UserRepository } from '../user.repository.js'
import type { User } from '../user.types.js'

export function getUserHandler(users: UserRepository) {
  return (id: string): User => requireUser(users, id)
}
