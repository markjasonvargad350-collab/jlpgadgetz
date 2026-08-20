import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { isProd } from '../config/env';

/**
 * Central error handler. Must be registered last. Translates known error types
 * into clean JSON; hides internals in production.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // If the response already started streaming, we can't rewrite status/body —
  // hand off to Express's built-in finalizer.
  if (res.headersSent) return next(err);

  // An error response must never be cached, even on an otherwise-public route
  // that set `Cache-Control: public` before the handler threw.
  res.setHeader('Cache-Control', 'no-store');

  const ctx = { id: req.id, method: req.method, path: req.originalUrl };

  // Validation errors (from zod schemas)
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: err.flatten().fieldErrors },
    });
  }

  if (err instanceof ApiError) {
    // Only server-fault (5xx) ApiErrors are worth logging; 4xx are client input.
    if (err.statusCode >= 500) logger.error('ApiError', { ...ctx, code: err.code, message: err.message });
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Known Prisma request errors → friendly status codes (never leak the raw
  // Prisma message, which can include column/constraint internals).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Do NOT echo err.meta.target — the offending unique column name is
      // internal detail we don't disclose to clients.
      return res.status(409).json({
        error: { message: 'A record with these unique values already exists', code: 'DUPLICATE' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { message: 'Related record not found', code: 'NOT_FOUND' } });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: { message: 'Invalid reference to a related record', code: 'BAD_REFERENCE' } });
    }
    // Any other known Prisma error is a client-fixable bad request.
    return res.status(400).json({ error: { message: 'Database request could not be completed', code: 'DB_REQUEST_ERROR' } });
  }

  // Unknown / unexpected error
  logger.error('Unhandled error', ctx, err);
  const message = isProd ? 'Internal server error' : (err as Error)?.message ?? 'Unknown error';
  return res.status(500).json({ error: { message, code: 'INTERNAL_ERROR' } });
}
