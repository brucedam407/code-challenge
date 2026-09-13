import { randomUUID } from 'node:crypto'
import { assertEmailFree } from '../user.guards.js'
import type { UserRepository } from '../user.repository.js'
import type { CreateUserInput } from '../user.schema.js'
import type { User } from '../user.types.js'

export function createUserHandler(users: UserRepository) {
  return (input: CreateUserInput): User => {
    assertEmailFree(users, input.email)

    return users.insert({
      id: randomUUID(),
      name: input.name,
      email: input.email,
      role: input.role,
      status: input.status,
      createdAt: new Date().toISOString(),
    })
  }
}
