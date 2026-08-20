import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { PageLoader } from '../components/admin/ui/Spinner';

/**
 * Layout route that gates the admin subtree. Blocks rendering until the initial
 * `me()` probe resolves (so we never flash the login page for an authed admin).
 * An authed admin proceeds; a server/network probe failure shows a retry screen
 * (not a login bounce); otherwise unauthenticated visitors go to /admin/login,
 * preserving the attempted location so login can bounce them back.
 */
export function RequireAuth() {
  const { admin, loading, probeError, retry } = useAdminAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (admin) return <Outlet />;
  if (probeError) return <ServerUnavailable onRetry={retry} />;
  return <Navigate to="/admin/login" replace state={{ from: location }} />;
}

function ServerUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-aurora grid min-h-screen place-items-center px-4" role="alert" aria-live="assertive">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl brand-gradient text-white">
          <AlertTriangle size={22} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Can’t reach the server</h1>
        <p className="mt-2 text-sm text-ink-soft">
          We couldn’t verify your session. Check your connection and try again.
        </p>
        <button
          onClick={onRetry}
          className="mt-6 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
