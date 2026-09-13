import { Router } from 'express'
import { rateLimit, type RateLimitOptions } from '../../middleware/rate-limit.js'
import { route } from '../../middleware/validate.js'
import { createUserHandler } from './handlers/create-user.js'
import { deleteUserHandler } from './handlers/delete-user.js'
import { getUserHandler } from './handlers/get-user.js'
import { listUsersHandler } from './handlers/list-users.js'
import { updateUserHandler } from './handlers/update-user.js'
import type { UserRepository } from './user.repository.js'
import {
  createUserSchema,
  makeListUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from './user.schema.js'

type IdParam = { id: string }

interface RouterOptions {
  maxPageSize: number
  createRate: RateLimitOptions
}

export function createUserRouter(users: UserRepository, options: RouterOptions): Router {
  const router = Router()
  const listUsersQuerySchema = makeListUsersQuerySchema(options.maxPageSize)

  const create = createUserHandler(users)
  const list = listUsersHandler(users)
  const get = getUserHandler(users)
  const update = updateUserHandler(users)
  const remove = deleteUserHandler(users)

  router.post(
    '/',
    rateLimit(options.createRate),
    route<CreateUserInput>({ body: createUserSchema }, ({ body, res }) => {
      const user = create(body)
      res.status(201).location(`/api/users/${user.id}`).json({ data: user })
    }),
  )

  router.get(
    '/',
    route<undefined, ListUsersQuery>({ query: listUsersQuerySchema }, ({ query, res }) => {
      const page = list(query)
      res.json({ data: page.items, meta: { pagination: page.pagination } })
    }),
  )

  router.get(
    '/:id',
    route<undefined, undefined, IdParam>({ params: userIdParamSchema }, ({ params, res }) => {
      res.json({ data: get(params.id) })
    }),
  )

  router.patch(
    '/:id',
    route<UpdateUserInput, undefined, IdParam>(
      { body: updateUserSchema, params: userIdParamSchema },
      ({ body, params, res }) => {
        res.json({ data: update(params.id, body) })
      },
    ),
  )

  router.delete(
    '/:id',
    route<undefined, undefined, IdParam>({ params: userIdParamSchema }, ({ params, res }) => {
      remove(params.id)
      res.status(204).end()
    }),
  )

  return router
}
