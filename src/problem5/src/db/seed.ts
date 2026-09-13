import { randomUUID } from 'node:crypto'
import { createDb } from './index.js'
import { logger } from '../lib/logger.js'
import { UserRepository } from '../modules/users/user.repository.js'
import type { UserRole, UserStatus } from '../modules/users/user.types.js'

const seedUsers: Array<{ name: string; email: string; role: UserRole; status: UserStatus }> = [
  { name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin', status: 'active' },
  { name: 'Grace Hopper', email: 'grace@example.com', role: 'admin', status: 'active' },
  { name: 'Alan Turing', email: 'alan@example.com', role: 'member', status: 'active' },
  { name: 'Katherine Johnson', email: 'katherine@example.com', role: 'member', status: 'inactive' },
  { name: 'Linus Torvalds', email: 'linus@example.com', role: 'member', status: 'suspended' },
  { name: 'Barbara Liskov', email: 'barbara@example.com', role: 'guest', status: 'active' },
]

const db = createDb()
const users = new UserRepository(db)

let created = 0
for (const [index, user] of seedUsers.entries()) {
  if (users.findByEmail(user.email)) continue
  users.insert({
    id: randomUUID(),
    ...user,
    // Spread over days, for the date filters.
    createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
  })
  created++
}

logger.info(`seed complete: ${created} created, ${seedUsers.length - created} already present`)
db.close()
