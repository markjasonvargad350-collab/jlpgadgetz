import { useCallback, useEffect, useState } from 'react';
import { listAdminProducts } from '../services/adminProducts';
import { ApiError } from '../services/http';
import type { Paginated } from '../types/api';
import type { AdminProductCard, AdminProductParams } from '../types/admin';

interface State {
  data: Paginated<AdminProductCard> | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the current page (e.g. after a delete). */
  reload: () => void;
}

/**
 * Fetch a page of admin products. Re-fetches when the serialized params change,
 * ignores stale responses, and exposes `reload()` for post-mutation refresh.
 */
export function useAdminProducts(params: AdminProductParams = {}): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(params);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listAdminProducts(JSON.parse(key) as AdminProductParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load products.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key, nonce]);

  return { ...state, reload };
}
