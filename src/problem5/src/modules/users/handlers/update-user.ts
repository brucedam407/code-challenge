import { HttpError } from '../../../lib/errors.js'
import { assertEmailFree, requireUser } from '../user.guards.js'
import type { UserRepository } from '../user.repository.js'
import type { UpdateUserInput } from '../user.schema.js'
import type { User } from '../user.types.js'

export function updateUserHandler(users: UserRepository) {
  return (id: string, input: UpdateUserInput): User => {
    requireUser(users, id)
    if (input.email !== undefined) assertEmailFree(users, input.email, id)

    const updated = users.update(id, { ...input, updatedAt: new Date().toISOString() })
    // The row went away between the two statements.
    if (!updated) throw HttpError.notFound(`No user with id ${id}`)
    return updated
  }
}
