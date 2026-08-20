import type { CookieOptions } from 'express';
import { isProd } from './env';

/**
 * Name of the HTTP-only cookie that carries the admin session JWT.
 * HTTP-only means client JavaScript can never read the token (XSS-resistant).
 */
export const AUTH_COOKIE = 'istore_admin_session';

/** Session lifetime in ms — kept in sync with the JWT default (7 days). */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookie attributes for the admin session. In production the API and client are
 * on different domains, so the cookie must be `Secure` + `SameSite=None` to be
 * sent cross-site; locally we use `Lax` over http via the Vite dev proxy.
 */
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  };
}
