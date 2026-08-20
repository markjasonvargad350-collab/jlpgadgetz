import type { Request, Response, NextFunction } from 'express';
import { CLIENT_ORIGINS } from '../config/env';
import { AUTH_COOKIE } from '../config/constants';
import { ApiError } from '../utils/ApiError';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for a cross-site SPA + cookie-authed API.
 *
 * In production the session cookie is `SameSite=None`, so browsers WILL attach
 * it to cross-site requests — the classic CSRF surface. For state-changing
 * methods we therefore verify the request came from an allowed client origin.
 * Browsers set `Origin` on all CORS requests and on all non-GET requests, so it
 * is reliably present for the mutations we care about (with `Referer` as a
 * fallback). If neither header is present we only reject when a session cookie
 * rides along — that is the only CSRF-exploitable case; header-less requests
 * without a cookie (curl, server-to-server, health probes) pass through.
 *
 * This composes with the CORS allowlist (same `CLIENT_ORIGINS` source) as
 * defense in depth; a double-submit token would be the heavier alternative.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = originOf(req);
  if (origin) {
    if (CLIENT_ORIGINS.includes(origin)) return next();
    return next(new ApiError(403, 'Cross-origin request rejected', 'CSRF_BLOCKED'));
  }

  // No Origin/Referer at all — only a cookie-bearing request is a CSRF risk.
  const hasSession = Boolean(req.cookies?.[AUTH_COOKIE]);
  if (hasSession) {
    return next(new ApiError(403, 'Missing origin on an authenticated request', 'CSRF_BLOCKED'));
  }
  return next();
}

/** The bare origin of the request per its Origin header, then Referer. */
function originOf(req: Request): string | null {
  for (const header of ['origin', 'referer'] as const) {
    const value = req.get(header);
    if (value) {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    }
  }
  return null;
}
