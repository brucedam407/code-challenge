/** Every deliberate answer; anything else is a bug. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details)
  }

  static validation(message: string, details: unknown) {
    return new HttpError(422, 'VALIDATION_ERROR', message, details)
  }

  static notFound(message: string) {
    return new HttpError(404, 'NOT_FOUND', message)
  }

  static conflict(message: string, details?: unknown) {
    return new HttpError(409, 'CONFLICT', message, details)
  }

  static tooManyRequests(message: string, details?: unknown) {
    return new HttpError(429, 'TOO_MANY_REQUESTS', message, details)
  }
}
