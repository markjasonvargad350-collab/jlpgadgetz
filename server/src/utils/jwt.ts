import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/** Claims we embed in the admin session token. */
export interface AuthTokenPayload {
  sub: string; // user id
  email: string;
  role: string; // role name, e.g. ADMIN / STAFF
}

/** Sign a session token for an authenticated admin. */
export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    // @types/jsonwebtoken types expiresIn as a branded string; our env value is
    // a plain string ("7d"), so we assert to the option's type.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify and decode a session token. Throws (JsonWebTokenError /
 * TokenExpiredError) on any invalid or expired token — callers translate that
 * into a 401.
 */
export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Unexpected string token payload');
  }
  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    role: String(decoded.role),
  };
}
