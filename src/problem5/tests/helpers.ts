import type { Express } from 'express'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDb, type Db } from '../src/db/index.js'

export interface Harness {
  app: Express
  db: Db
  api: () => request.Agent
  createUser: (overrides?: Record<string, unknown>) => Promise<User>
  createUsers: (count: number) => Promise<User[]>
  close: () => void
}

interface User {
  id: string
  name: string
  email: string
  index: number
  createdAt: string
  updatedAt: string
}

export const validUser = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
  status: 'active',
} as const

/** A whole server per test file, on an in-memory database. */
export function createHarness(limits?: {
  maxPageSize?: number
  createRateLimit?: number
  createRateWindowMs?: number
}): Harness {
  const db = createDb(':memory:')
  // A high create limit unless a test asks for a low one, so no suite trips
  // over the rate limiter while setting up its own fixtures.
  const app = createApp({ db, limits: { createRateLimit: 1000, ...limits } })
  const api = () => request(app)

  const createUser = async (overrides: Record<string, unknown> = {}) => {
    const response = await api()
      .post('/api/users')
      .send({ ...validUser, ...overrides })
      .expect(201)
    return response.body.data as User
  }

  return {
    app,
    db,
    api,
    createUser,
    createUsers: async (count: number) => {
      const users: User[] = []
      for (let index = 0; index < count; index++) {
        users.push(await createUser({ email: `user${index}@example.com`, name: `User ${index}` }))
      }
      return users
    },
    close: () => db.close(),
  }
}
