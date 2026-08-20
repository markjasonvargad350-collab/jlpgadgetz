import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { signAuthToken, type AuthTokenPayload } from '../utils/jwt';

/** Public-safe view of an admin (never includes the password hash). */
export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt: Date | null;
}

/**
 * A valid bcrypt hash of a throwaway string, computed once at startup. When an
 * email doesn't exist we still run a bcrypt comparison against this so the
 * response time doesn't reveal whether the account exists (timing-attack
 * hardening).
 */
const DUMMY_HASH = bcrypt.hashSync('no-such-user-placeholder', 12);

/**
 * Authenticate an admin by email + password. Returns a signed session token and
 * the public profile. The error message is deliberately generic so it never
 * leaks whether the email or the password was the wrong one.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; admin: AdminProfile }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { role: true },
  });

  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const now = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });

  const payload: AuthTokenPayload = { sub: user.id, email: user.email, role: user.role.name };
  const token = signAuthToken(payload);

  return {
    token,
    admin: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      lastLoginAt: now,
    },
  };
}

/** Load the current admin's profile by id (used by GET /me). */
export async function getProfile(userId: string): Promise<AdminProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Session is no longer valid');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    lastLoginAt: user.lastLoginAt,
  };
}
