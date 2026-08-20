import type { AuthTokenPayload } from '../utils/jwt';

/**
 * Augment Express's Request with the authenticated admin, populated by the
 * `requireAuth` middleware after verifying the session cookie.
 */
declare global {
  namespace Express {
    interface Request {
      admin?: AuthTokenPayload;
    }
  }
}

export {};
