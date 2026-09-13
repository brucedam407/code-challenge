import type { RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import { logger } from '../lib/logger.js'

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = req.header('x-request-id') ?? randomUUID()
  res.setHeader('X-Request-Id', requestId)

  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`, {
      requestId,
    })
  })

  next()
}
