export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function badRequest(message: string, details?: Record<string, string[]>): never {
  throw new AppError(400, message, details)
}

export function unauthorized(message = 'Unauthorized'): never {
  throw new AppError(401, message)
}

export function forbidden(message = 'Forbidden'): never {
  throw new AppError(403, message)
}

export function notFound(resource: string): never {
  throw new AppError(404, `${resource} not found`)
}

export function conflict(message: string): never {
  throw new AppError(409, message)
}
