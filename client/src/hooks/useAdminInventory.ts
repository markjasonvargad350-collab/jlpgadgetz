import { useCallback, useEffect, useState } from 'react';
import { listInventory } from '../services/adminInventory';
import { ApiError } from '../services/http';
import type { Paginated } from '../types/api';
import type { InventoryRow, InventoryParams } from '../types/admin';

interface State {
  data: Paginated<InventoryRow> | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the current page (e.g. after a stock adjustment). */
  reload: () => void;
}

/**
 * Fetch a page of the variant-centric inventory list. Re-fetches on param
 * change, ignores stale responses, and exposes `reload()` for post-adjust refresh.
 */
export function useAdminInventory(params: InventoryParams = {}): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(params);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listInventory(JSON.parse(key) as InventoryParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load inventory.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key, nonce]);

  return { ...state, reload };
}
