export const USER_ROLES = ['admin', 'member', 'guest'] as const
export const USER_STATUSES = ['active', 'inactive', 'suspended'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
}

export interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
