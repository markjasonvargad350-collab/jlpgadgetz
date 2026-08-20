import type { AuthTokenPayload } from '../utils/jwt';

/**
 * Augment Express's Request with:
 *  - `admin`: the authenticated admin, populated by `requireAuth` after
 *    verifying the session cookie.
 *  - `id`: a per-request correlation id assigned by the `requestLog` middleware
 *    and echoed as the `X-Request-Id` response header.
 */
declare global {
  namespace Express {
    interface Request {
      admin?: AuthTokenPayload;
      id?: string;
    }
  }
}

export {};
