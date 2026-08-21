import { useCallback, useEffect, useState } from 'react';
import { getAdminInstallment } from '../services/adminInstallments';
import { ApiError } from '../services/http';
import type { InstallmentDTO } from '../types/installment';

interface State {
  data: InstallmentDTO | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the plan (also used to recover from a stale-status 409). */
  reload: () => void;
}

/** Fetch one installment plan (with its schedule) by id. `null` skips the fetch. */
export function useAdminInstallment(id: string | null): State {
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

    getAdminInstallment(id)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load installment plan.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [id, nonce]);

  return { ...state, reload };
}
