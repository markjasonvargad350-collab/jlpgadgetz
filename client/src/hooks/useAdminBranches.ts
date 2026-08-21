import { useCallback, useEffect, useState } from 'react';
import { listAdminBranches } from '../services/adminBranches';
import { ApiError } from '../services/http';
import type { Paginated } from '../types/api';
import type { AdminBranch, AdminBranchParams } from '../types/admin';

interface State {
  data: Paginated<AdminBranch> | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the current page (e.g. after a delete). */
  reload: () => void;
}

/**
 * Fetch a page of branches for the back-office. Re-fetches when the serialized
 * params change, ignores stale responses, and exposes `reload()`.
 */
export function useAdminBranches(params: AdminBranchParams = {}): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(params);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listAdminBranches(JSON.parse(key) as AdminBranchParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load branches.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key, nonce]);

  return { ...state, reload };
}
