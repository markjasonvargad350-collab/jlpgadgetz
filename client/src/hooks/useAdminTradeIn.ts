import { useCallback, useEffect, useState } from 'react';
import { getAdminTradeIn } from '../services/adminTradeIns';
import { ApiError } from '../services/http';
import type { TradeInDTO } from '../types/tradeIn';

interface State {
  data: TradeInDTO | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the record (also used to recover from a stale-status 409). */
  reload: () => void;
}

/** Fetch one trade-in application by id. `null` skips the fetch. */
export function useAdminTradeIn(id: string | null): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({
    data: null,
    loading: id !== null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (id === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    getAdminTradeIn(id)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load trade-in.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [id, nonce]);

  return { ...state, reload };
}
