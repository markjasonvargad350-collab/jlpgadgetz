import { useEffect, useState } from 'react';
import { listCategories } from '../services/categories';
import type { Category } from '../types/api';

interface UseCategoriesState {
  data: Category[];
  loading: boolean;
  error: string | null;
}

/** Fetch active categories once on mount. */
export function useCategories(): UseCategoriesState {
  const [state, setState] = useState<UseCategoriesState>({ data: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
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
  }, []);

  return state;
}
