import { HttpError } from '../../../lib/errors.js'
import type { UserRepository } from '../user.repository.js'

export function deleteUserHandler(users: UserRepository) {
  return (id: string): void => {
    if (!users.delete(id)) throw HttpError.notFound(`No user with id ${id}`)
  }
}
