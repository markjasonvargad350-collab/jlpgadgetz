import { useCallback, useEffect, useState } from 'react';
import { getInventoryStats } from '../services/adminInventory';
import { ApiError } from '../services/http';
import type { InventoryStats } from '../types/admin';

interface UseInventoryStatsState {
  data: InventoryStats | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch (e.g. after a stock adjustment). */
  reload: () => void;
}

/** Fetch the dashboard/inventory stats. Exposes `reload()` to refresh on demand. */
export function useInventoryStats(): UseInventoryStatsState {
  const [state, setState] = useState<Omit<UseInventoryStatsState, 'reload'>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    getInventoryStats()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load inventory stats.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [nonce]);

  return { ...state, reload };
}
