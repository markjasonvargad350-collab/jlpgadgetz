import { useCallback, useEffect, useState } from 'react';
import { listAdminTradeIns } from '../services/adminTradeIns';
import { ApiError } from '../services/http';
import type { Paginated } from '../types/api';
import type { AdminTradeInCard, AdminTradeInParams } from '../types/admin';

interface State {
  data: Paginated<AdminTradeInCard> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Fetch a page of trade-in applications for the back-office. */
export function useAdminTradeIns(params: AdminTradeInParams = {}): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(params);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listAdminTradeIns(JSON.parse(key) as AdminTradeInParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load trade-ins.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key, nonce]);

  return { ...state, reload };
}
