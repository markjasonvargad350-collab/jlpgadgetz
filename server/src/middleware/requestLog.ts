import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger';

const REQUEST_ID_HEADER = 'X-Request-Id';

// Only trust an inbound request id if it is short and boringly-shaped, so a
// client can't inject huge or control-character values into our logs/headers.
const isSaneId = (v: string) => /^[\w.-]{1,128}$/.test(v);

/**
 * Assigns each request a stable id (honoring an inbound `X-Request-Id` from a
 * proxy/gateway when present), echoes it back in the response header, and logs
 * one structured line per request when the response finishes — routing the log
 * level by status class (5xx→error, 4xx→warn, else info).
 */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const inbound = req.get(REQUEST_ID_HEADER);
  req.id = inbound && isSaneId(inbound) ? inbound : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    const meta = { id: req.id };
    if (res.statusCode >= 500) logger.error(line, meta);
    else if (res.statusCode >= 400) logger.warn(line, meta);
    else logger.info(line, meta);
  });

  next();
}
