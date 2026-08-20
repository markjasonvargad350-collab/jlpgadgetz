import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { AUTH_COOKIE, authCookieOptions } from '../config/constants';
import * as authService from '../services/auth.service';
import type { LoginInput } from '../validators/auth.validator';

/** POST /api/admin/auth/login — verify credentials, set the session cookie. */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const { token, admin } = await authService.login(email, password);
  res.cookie(AUTH_COOKIE, token, authCookieOptions());
  res.json({ admin });
});

/** POST /api/admin/auth/logout — clear the session cookie. */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  const { maxAge, ...clearOpts } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE, clearOpts);
  res.json({ success: true });
});

/** GET /api/admin/auth/me — return the currently authenticated admin. */
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) {
    throw ApiError.unauthorized();
  }
  const admin = await authService.getProfile(req.admin.sub);
  res.json({ admin });
});
