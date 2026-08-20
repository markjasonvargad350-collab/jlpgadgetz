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
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Validation errors (from zod schemas)
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: err.flatten().fieldErrors },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Known Prisma request errors → friendly status codes (never leak the raw
  // Prisma message, which can include column/constraint internals).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      return res.status(409).json({
        error: {
          message: 'A record with these unique values already exists',
          code: 'DUPLICATE',
          ...(target ? { details: { target } } : {}),
        },
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
  logger.error(err);
  const message = isProd ? 'Internal server error' : (err as Error)?.message ?? 'Unknown error';
  return res.status(500).json({ error: { message, code: 'INTERNAL_ERROR' } });
}
