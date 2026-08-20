import { useCallback, useEffect, useState } from 'react';
import { getOrder } from '../services/adminOrders';
import { ApiError } from '../services/http';
import type { OrderDTO } from '../types/order';

interface State {
  data: OrderDTO | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the order (e.g. after advancing/cancelling its status). */
  reload: () => void;
}

/**
 * Fetch a single admin order by its number. Pass `null` to skip the fetch. Keeps
 * the prior order visible during a reload so the detail view never flashes empty.
 */
export function useAdminOrder(orderNumber: string | null): State {
  const [state, setState] = useState<Omit<State, 'reload'>>({
    data: null,
    loading: orderNumber !== null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (orderNumber === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    getOrder(orderNumber)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load order.';
        setState((s) => ({ ...s, loading: false, error: message }));
      });

    return () => {
      active = false;
    };
  }, [orderNumber, nonce]);

  return { ...state, reload };
}
