import type { ErrorRequestHandler, RequestHandler } from 'express'
import { HttpError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { config } from '../config.js'

/** Knows only HttpError and what Express throws; the layers translate their own. */
interface ErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
    stack?: string
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.path}`))
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const mapped = toHttpError(error)
  const unexpected = mapped.code === 'INTERNAL_ERROR'

  if (unexpected) {
    logger.error(`${req.method} ${req.originalUrl} failed`, {
      message: mapped.message,
      stack: error instanceof Error ? error.stack : undefined,
    })
  }

  const body: ErrorBody = {
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    },
  }
  if (config.NODE_ENV === 'development' && unexpected && error instanceof Error) {
    if (error.stack !== undefined) body.error.stack = error.stack
  }

  res.status(mapped.status).json(body)
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error

  // How express.json() reports bad JSON.
  if (error instanceof SyntaxError && 'body' in error) {
    return HttpError.badRequest('Request body is not valid JSON')
  }

  // 413, 415 and friends know their own status; otherwise they become 500s.
  const status = httpErrorStatus(error)
  if (status !== null) {
    return new HttpError(status, statusCode(status), (error as Error).message)
  }

  return new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong on our side')
}

/** A 4xx whose message is safe to pass on. */
function httpErrorStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  const candidate = error as Error & { status?: unknown; statusCode?: unknown; expose?: unknown }
  const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode
  if (typeof status !== 'number' || status < 400 || status > 499) return null
  return candidate.expose === true ? status : null
}

function statusCode(status: number): string {
  if (status === 413) return 'PAYLOAD_TOO_LARGE'
  if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE'
  return 'BAD_REQUEST'
}
