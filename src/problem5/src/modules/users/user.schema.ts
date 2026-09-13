import { z } from 'zod'
import { USER_ROLES, USER_STATUSES } from './user.types.js'

const name = z.string().trim().min(1, 'name must not be empty').max(120)

const isoTimestamp = z.iso
  .datetime({ message: 'must be an ISO 8601 timestamp' })
  .transform((value) => new Date(value).toISOString())
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('must be a valid email address').max(254))

export const createUserSchema = z.strictObject({
  name,
  email,
  role: z.enum(USER_ROLES).default('member'),
  status: z.enum(USER_STATUSES).default('active'),
})

export const updateUserSchema = z
  .strictObject({
    name: name.optional(),
    email: email.optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'provide at least one field to update',
  })

/** A factory, so the cap is injected, not read at import. */
export const makeListUsersQuerySchema = (maxPageSize: number) =>
  z.strictObject({
    q: z.string().trim().min(1).max(120).optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
    // Canonicalised: created_at is compared as text, and 'Z' sorts after '.'.
    createdAfter: isoTimestamp.optional(),
    createdBefore: isoTimestamp.optional(),
    sort: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(maxPageSize).default(20),
  })

export const userIdParamSchema = z.strictObject({
  id: z.uuid('must be a UUID'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ListUsersQuery = z.infer<ReturnType<typeof makeListUsersQuerySchema>>
