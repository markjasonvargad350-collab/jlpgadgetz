import { useCallback, useEffect, useState } from 'react';
import { listOrders } from '../services/adminOrders';
import { ApiError } from '../services/http';
import type { Paginated } from '../types/api';
import type { AdminOrderCard, AdminOrderParams } from '../types/admin';

interface State {
  data: Paginated<AdminOrderCard> | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the current page (e.g. after a status change elsewhere). */
  reload: () => void;
}

/**
 * Fetch a page of the admin order list. Re-fetches on param change, ignores
 * stale responses, and exposes `reload()` for post-mutation refresh.
 */
export function useAdminOrders(params: AdminOrderParams = {}): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(params);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listOrders(JSON.parse(key) as AdminOrderParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load orders.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key, nonce]);

  return { ...state, reload };
}
