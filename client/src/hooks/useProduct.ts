import { useEffect, useState } from 'react';
import { getProduct } from '../services/products';
import { ApiError } from '../services/http';
import type { ProductDetail } from '../types/api';

interface UseProductState {
  data: ProductDetail | null;
  loading: boolean;
  /** Set for any failure; `notFound` distinguishes a 404 for a nicer UI. */
  error: string | null;
  notFound: boolean;
}

/** Fetch a single product by id or slug. Ignores stale responses. */
export function useProduct(idOrSlug: string | undefined): UseProductState {
  const [state, setState] = useState<UseProductState>({
    data: null,
    loading: true,
    error: null,
    notFound: false,
  });

  useEffect(() => {
    if (!idOrSlug) {
      setState({ data: null, loading: false, error: 'Missing product.', notFound: true });
      return;
    }

    let active = true;
    setState({ data: null, loading: true, error: null, notFound: false });

    getProduct(idOrSlug)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null, notFound: false });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const notFound = err instanceof ApiError && err.status === 404;
        const message =
          err instanceof ApiError ? err.message : 'Something went wrong loading this product.';
        setState({ data: null, loading: false, error: message, notFound });
      });

    return () => {
      active = false;
    };
  }, [idOrSlug]);

  return state;
}
