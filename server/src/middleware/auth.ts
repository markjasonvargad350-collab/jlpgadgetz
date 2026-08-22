import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/jwt';
import { getProfile } from '../services/auth.service';
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
 *
 * The role is re-read from the database rather than taken from the session
 * token. The token's `role` claim is minted at login and lives for
 * `JWT_EXPIRES_IN` (7 days by default), so trusting it means a role change takes
 * up to a week to reach the server — while `GET /me` reports the new role
 * immediately and the UI un-hides the buttons it guards. That split is worse than
 * one indexed lookup: only a handful of routes are role-gated, and re-reading also
 * makes deactivating an account effective at once instead of at cookie expiry.
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(ApiError.unauthorized());
    }
    try {
      // Throws 401 when the user has been deleted or deactivated since login.
      const { role } = await getProfile(req.admin.sub);
      if (roles.length > 0 && !roles.includes(role)) {
        return next(ApiError.forbidden());
      }
      req.admin.role = role; // keep downstream handlers on the current role
      next();
    } catch (err) {
      next(err);
    }
  };
}
