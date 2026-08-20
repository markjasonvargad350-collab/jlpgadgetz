import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as adminAuth from '../services/adminAuth';
import type { AdminProfile } from '../types/admin';

interface AdminAuthContextValue {
  /** The signed-in admin, or null when unauthenticated. */
  admin: AdminProfile | null;
  /** True until the initial `me()` probe resolves — gate route guards on this. */
  loading: boolean;
  /** Convenience: the admin holds the elevated ADMIN role (vs STAFF). */
  isAdmin: boolean;
  /** Sign in; throws ApiError on bad credentials / rate limit for the caller to show. */
  login: (email: string, password: string) => Promise<void>;
  /** Sign out; always clears local state even if the network call fails. */
  logout: () => Promise<void>;
  /** Re-probe the session (e.g. after a role change). */
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

/**
 * Holds the admin session. Mounted only under the `/admin/*` subtree (see
 * App.tsx), so the storefront never fires the `me()` probe. The session cookie
 * is HTTP-only — this context is the single source of truth the UI can read.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from the cookie once on mount.
  useEffect(() => {
    let active = true;
    adminAuth
      .fetchMe()
      .then((profile) => {
        if (active) setAdmin(profile);
      })
      .catch(() => {
        // Network/5xx during the probe → treat as signed-out; user can retry.
        if (active) setAdmin(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const profile = await adminAuth.login(email, password);
    setAdmin(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminAuth.logout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setAdmin(await adminAuth.fetchMe());
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      admin,
      loading,
      isAdmin: admin?.role === 'ADMIN',
      login,
      logout,
      refresh,
    }),
    [admin, loading, login, logout, refresh],
  );

  return <AdminAuthContext value={value}>{children}</AdminAuthContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}
