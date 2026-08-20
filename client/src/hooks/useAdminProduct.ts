import { useCallback, useEffect, useState } from 'react';
import { getAdminProduct } from '../services/adminProducts';
import { ApiError } from '../services/http';
import type { AdminProductDetail } from '../types/admin';

interface State {
  data: AdminProductDetail | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the product (e.g. after adding a variant/image). */
  reload: () => void;
}

/**
 * Fetch a single admin product by id. Pass `null` (the /new route) to skip the
 * fetch entirely — the hook then resolves immediately with no data.
 */
export function useAdminProduct(id: string | null): State {
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

    getAdminProduct(id)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load product.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [id, nonce]);

  return { ...state, reload };
}
