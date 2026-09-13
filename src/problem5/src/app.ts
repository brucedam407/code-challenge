import express, { type Express } from 'express'
import { config } from './config.js'
import type { Db } from './db/index.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'
import { UserRepository } from './modules/users/user.repository.js'
import { createUserRouter } from './modules/users/user.routes.js'

export interface AppDependencies {
  db: Db
  limits?:
    | {
        maxPageSize?: number | undefined
        createRateLimit?: number | undefined
        createRateWindowMs?: number | undefined
      }
    | undefined
}

export function createApp({ db, limits }: AppDependencies): Express {
  const maxPageSize = limits?.maxPageSize ?? config.MAX_PAGE_SIZE
  const createRate = {
    limit: limits?.createRateLimit ?? config.CREATE_RATE_LIMIT,
    windowMs: limits?.createRateWindowMs ?? config.CREATE_RATE_WINDOW_SECONDS * 1000,
  }

  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(requestLogger)

  const users = new UserRepository(db)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
  })

  app.use('/api/users', createUserRouter(users, { maxPageSize, createRate }))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
