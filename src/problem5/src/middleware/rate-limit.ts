import type { RequestHandler } from 'express'
import { HttpError } from '../lib/errors.js'

export interface RateLimitOptions {
  limit: number
  windowMs: number
  /** Injectable so a test can cross a window without waiting for one. */
  now?: () => number
}

/**
 * A fixed window per client: `limit` requests, then 429 until it rolls over.
 * Counters live in the process, so each instance enforces its own share - a
 * deployment behind a load balancer wants this at the edge instead.
 */
export function rateLimit({ limit, windowMs, now = Date.now }: RateLimitOptions): RequestHandler {
  const clients = new Map<string, { count: number; resetAt: number }>()
  let nextSweep = now() + windowMs

  return (req, res, next) => {
    const at = now()

    // Without this the map grows one entry per client, forever.
    if (at >= nextSweep) {
      for (const [key, window] of clients) if (window.resetAt <= at) clients.delete(key)
      nextSweep = at + windowMs
    }

    // req.ip is the socket address unless the app trusts a proxy.
    const key = req.ip ?? 'unknown'
    const existing = clients.get(key)
    const window =
      existing && existing.resetAt > at ? existing : { count: 0, resetAt: at + windowMs }

    window.count++
    clients.set(key, window)

    const resetSeconds = Math.ceil((window.resetAt - at) / 1000)
    res.setHeader('RateLimit-Limit', limit)
    res.setHeader('RateLimit-Remaining', Math.max(0, limit - window.count))
    res.setHeader('RateLimit-Reset', resetSeconds)

    if (window.count > limit) {
      res.setHeader('Retry-After', resetSeconds)
      throw HttpError.tooManyRequests(
        `No more than ${limit} requests per ${Math.round(windowMs / 1000)}s`,
        { retryAfterSeconds: resetSeconds },
      )
    }

    next()
  }
}
