import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as adminAuth from '../services/adminAuth';
import { ApiError } from '../services/http';
import type { AdminProfile } from '../types/admin';

interface AdminAuthContextValue {
  /** The signed-in admin, or null when unauthenticated. */
  admin: AdminProfile | null;
  /** True until the initial `me()` probe resolves — gate route guards on this. */
  loading: boolean;
  /**
   * True when the initial probe failed for a reason OTHER than a 401 (network
   * down, server 5xx). Distinct from "signed out" — the guard offers a retry
   * instead of bouncing to login.
   */
  probeError: boolean;
  /** Convenience: the admin holds the elevated ADMIN role (vs STAFF). */
  isAdmin: boolean;
  /** Sign in; throws ApiError on bad credentials / rate limit for the caller to show. */
  login: (email: string, password: string) => Promise<void>;
  /** Sign out; always clears local state even if the network call fails. */
  logout: () => Promise<void>;
  /** Re-probe the session (e.g. after a role change). */
  refresh: () => Promise<void>;
  /** Retry the initial session probe after a network/server failure. */
  retry: () => void;
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
  const [probeError, setProbeError] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Hydrate from the cookie on mount, and again whenever `retry` bumps `nonce`.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setProbeError(false);
    adminAuth
      .fetchMe()
      .then((profile) => {
        if (active) setAdmin(profile);
      })
      .catch((err: unknown) => {
        if (!active) return;
        // A 401 is a definitive "not signed in". Anything else (network, 5xx)
        // means we couldn't verify — surface a retryable error, don't sign out.
        if (err instanceof ApiError && err.status === 401) {
          setAdmin(null);
        } else {
          setProbeError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const login = useCallback(async (email: string, password: string) => {
    const profile = await adminAuth.login(email, password);
    setProbeError(false);
    setAdmin(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminAuth.logout();
    } finally {
      setProbeError(false);
      setAdmin(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setAdmin(await adminAuth.fetchMe());
  }, []);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      admin,
      loading,
      probeError,
      isAdmin: admin?.role === 'ADMIN',
      login,
      logout,
      refresh,
      retry,
    }),
    [admin, loading, probeError, login, logout, refresh, retry],
  );

  return <AdminAuthContext value={value}>{children}</AdminAuthContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}
