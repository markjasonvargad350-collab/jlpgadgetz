import { useCallback, useEffect, useState } from 'react';
import { getOrder } from '../services/orders';
import { ApiError } from '../services/http';
import type { OrderDTO } from '../types/order';

interface State {
  data: OrderDTO | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch now (used by the poller and manual refresh). */
  reload: () => void;
}

/**
 * Guest order tracking. Pass a null orderNumber/email to stay idle (before the
 * lookup form is submitted). Once both are set it fetches, keeps any prior order
 * visible during refreshes, and polls every ~20s — but only while the tab is
 * visible and the order is still moving (stops at DELIVERED / CANCELLED).
 *
 * The email is the guest's proof of ownership: the server 404s on a mismatch and
 * never confirms a bare order number, so a wrong email surfaces as "not found".
 */
export function useOrderTracking(orderNumber: string | null, email: string | null): State {
  const has = Boolean(orderNumber && email);
  const [state, setState] = useState<Omit<State, 'reload'>>({
    data: null,
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!orderNumber || !email) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    getOrder(orderNumber, email)
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const message =
          err instanceof ApiError && err.status === 404
            ? "We couldn't find an order with that number and email. Please double-check both."
            : err instanceof ApiError
              ? err.message
              : 'Something went wrong. Please try again.';
        // Keep any prior order on a transient poll failure; a failed first
        // lookup has null data already, so this still surfaces the error.
        setState((s) => ({ ...s, loading: false, error: message }));
      });

    return () => {
      alive = false;
    };
  }, [orderNumber, email, nonce]);

  // Visibility-gated polling — only while an active, still-moving order is shown.
  const status = state.data?.status;
  useEffect(() => {
    if (!has || !status || status === 'DELIVERED' || status === 'CANCELLED') return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 20000);
    return () => window.clearInterval(id);
  }, [has, status, reload]);

  return { ...state, reload };
}
