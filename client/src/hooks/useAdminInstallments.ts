import { useCallback, useEffect, useState } from 'react';
import { listAdminInstallments } from '../services/adminInstallments';
import { ApiError } from '../services/http';
import type { Paginated } from '../types/api';
import type { AdminInstallmentCard, AdminInstallmentParams } from '../types/admin';

interface State {
  data: Paginated<AdminInstallmentCard> | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Fetch a page of installment plans for the back-office. */
export function useAdminInstallments(params: AdminInstallmentParams = {}): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(params);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listAdminInstallments(JSON.parse(key) as AdminInstallmentParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load installments.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key, nonce]);

  return { ...state, reload };
}
