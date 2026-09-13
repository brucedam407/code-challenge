import type { Request, RequestHandler, Response } from 'express'
import type { ZodType } from 'zod'
import { HttpError } from '../lib/errors.js'

interface Schemas<B, Q, P> {
  body?: ZodType<B>
  query?: ZodType<Q>
  params?: ZodType<P>
}

interface Context<B, Q, P> {
  body: B
  query: Q
  params: P
  req: Request
  res: Response
}

/** Validation and handler in one call, so body/query/params arrive typed. */
export function route<B = undefined, Q = undefined, P = undefined>(
  schemas: Schemas<B, Q, P>,
  handler: (ctx: Context<B, Q, P>) => void | Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    const body = parse(schemas.body, req.body, 'body')
    const query = parse(schemas.query, req.query, 'query')
    const params = parse(schemas.params, req.params, 'params')

    Promise.resolve(handler({ body, query, params, req, res })).catch(next)
  }
}

function parse<T>(schema: ZodType<T> | undefined, value: unknown, source: string): T {
  if (!schema) return undefined as T

  const result = schema.safeParse(value)
  if (result.success) return result.data

  throw HttpError.validation(`Invalid request ${source}`, {
    source,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.') || source,
      code: issue.code,
      message: issue.message,
    })),
  })
}
