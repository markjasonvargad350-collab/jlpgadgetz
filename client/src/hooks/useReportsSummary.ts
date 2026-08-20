import { useCallback, useEffect, useState } from 'react';
import { getReportSummary } from '../services/adminReports';
import { ApiError } from '../services/http';
import type { ReportSummary } from '../types/admin';

interface UseReportsSummaryState {
  data: ReportSummary | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch on demand. */
  reload: () => void;
}

/** Fetch the reports summary (KPIs, breakdowns, daily revenue, top products). */
export function useReportsSummary(): UseReportsSummaryState {
  const [state, setState] = useState<Omit<UseReportsSummaryState, 'reload'>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    getReportSummary()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof ApiError ? err.message : 'Failed to load reports.';
        setState({ data: null, loading: false, error: message });
      });

    return () => {
      active = false;
    };
  }, [nonce]);

  return { ...state, reload };
}
