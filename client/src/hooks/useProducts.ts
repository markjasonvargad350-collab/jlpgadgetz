import { useEffect, useState } from 'react';
import { listProducts } from '../services/products';
import { ApiError } from '../services/http';
import type { Paginated, ProductCard, ProductListParams } from '../types/api';

interface UseProductsState {
  data: Paginated<ProductCard> | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch a page of products for the given params. Re-fetches whenever the
 * serialized params change. Ignores stale responses if params change mid-flight.
 */
export function useProducts(params: ProductListParams = {}): UseProductsState {
  const [state, setState] = useState<UseProductsState>({ data: null, loading: true, error: null });
  const key = JSON.stringify(params);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    listProducts(JSON.parse(key) as ProductListParams)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Something went wrong loading products.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [key]);

  return state;
}
