import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { PageLoader } from '../components/admin/ui/Spinner';

/**
 * Layout route that gates the admin subtree. Blocks rendering until the initial
 * `me()` probe resolves (so we never flash the login page for an authed admin),
 * then redirects unauthenticated visitors to /admin/login, preserving the
 * attempted location so login can bounce them back.
 */
export function RequireAuth() {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return <Outlet />;
}
