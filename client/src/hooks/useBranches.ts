import { useCallback, useEffect, useState } from 'react';
import { listBranches } from '../services/branches';
import type { Branch } from '../types/api';

interface UseBranchesState {
  data: Branch[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetch the active JLP branches on mount, with a `reload` for retry-on-error.
 * Used by the About page and by every branch picker (checkout, trade-in,
 * installment) — a failed load leaves `data` empty so a picker can simply hide
 * itself rather than block the form.
 */
export function useBranches(): UseBranchesState & { reload: () => void } {
  const [state, setState] = useState<UseBranchesState>({ data: [], loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    listBranches()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch(() => {
        if (active) setState({ data: [], loading: false, error: 'Failed to load branches.' });
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
