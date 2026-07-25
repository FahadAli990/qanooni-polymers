import { logger } from '../utils/logger.js'
import { fail } from '../utils/apiResponse.js'

export function notFoundHandler(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404)
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500
  if (status >= 500) {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.originalUrl,
    })
  } else {
    logger.warn('Request failed', {
      error: err.message,
      status,
      path: req.originalUrl,
    })
  }

  if (res.headersSent) return next(err)
  return fail(res, err.message || 'Internal server error', status)
}
