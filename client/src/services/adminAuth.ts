import { http, ApiError } from './http';
import type { AdminProfile } from '../types/admin';

/**
 * Admin session services. The session lives in an HTTP-only cookie the browser
 * JS cannot read, so auth state is hydrated by probing `me()` on mount.
 */

/** POST /api/admin/auth/login — sets the session cookie, returns the profile. */
export async function login(email: string, password: string): Promise<AdminProfile> {
  const { data } = await http.post<{ admin: AdminProfile }>('/admin/auth/login', { email, password });
  return data.admin;
}

/**
 * GET /api/admin/auth/me — the current admin, or `null` when unauthenticated.
 * A 401 is the normal "not logged in" answer, so it resolves to null; any other
 * failure (network/5xx) propagates so the caller can decide.
 */
export async function fetchMe(): Promise<AdminProfile | null> {
  try {
    const { data } = await http.get<{ admin: AdminProfile }>('/admin/auth/me');
    return data.admin;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/** POST /api/admin/auth/logout — clears the session cookie server-side. */
export async function logout(): Promise<void> {
  await http.post('/admin/auth/logout');
}
