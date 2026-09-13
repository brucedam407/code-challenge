import { HttpError } from '../../../lib/errors.js'
import type { UserRepository } from '../user.repository.js'
import type { ListUsersQuery } from '../user.schema.js'
import type { User } from '../user.types.js'

export interface UserPage {
  items: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
  }
}

export function listUsersHandler(users: UserRepository) {
  return (query: ListUsersQuery): UserPage => {
    if (
      query.createdAfter !== undefined &&
      query.createdBefore !== undefined &&
      query.createdAfter > query.createdBefore
    ) {
      throw HttpError.badRequest('createdAfter must not be later than createdBefore')
    }

    const { items, total } = users.list(query)
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext: query.page * query.limit < total,
      },
    }
  }
}
