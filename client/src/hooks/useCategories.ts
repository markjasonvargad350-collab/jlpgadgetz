import { useCallback, useEffect, useState } from 'react';
import { listCategories } from '../services/categories';
import type { Category } from '../types/api';

interface UseCategoriesState {
  data: Category[];
  loading: boolean;
  error: string | null;
}

/** Fetch active categories on mount, with a `reload` for retry-on-error. */
export function useCategories(): UseCategoriesState & { reload: () => void } {
  const [state, setState] = useState<UseCategoriesState>({ data: [], loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    listCategories()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch(() => {
        if (active) setState({ data: [], loading: false, error: 'Failed to load categories.' });
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
