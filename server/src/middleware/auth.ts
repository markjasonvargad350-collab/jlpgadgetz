import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/jwt';
import { AUTH_COOKIE } from '../config/constants';
import { ApiError } from '../utils/ApiError';

/**
 * Require a valid admin session. Reads the JWT from the HTTP-only cookie,
 * verifies it, and attaches the decoded claims to `req.admin`. Rejects with 401
 * when the cookie is missing, malformed, or expired.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    return next(ApiError.unauthorized());
  }
  try {
    req.admin = verifyAuthToken(token);
    next();
  } catch {
    next(ApiError.unauthorized('Session expired or invalid'));
  }
}

/**
 * Require the authenticated admin to hold one of the given roles. Must run after
 * `requireAuth`. With no roles listed it only asserts that someone is logged in.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(ApiError.unauthorized());
    }
    if (roles.length > 0 && !roles.includes(req.admin.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
