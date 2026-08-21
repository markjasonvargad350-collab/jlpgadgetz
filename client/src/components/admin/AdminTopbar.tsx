import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, Menu } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Spinner } from './ui/Spinner';

/** Titles keyed by the first path segment after `/admin`. */
const TITLES: Record<string, string> = {
  '': 'Dashboard',
  orders: 'Orders',
  products: 'Products',
  inventory: 'Inventory',
  'trade-ins': 'Trade-ins',
  installments: 'Installments',
  branches: 'Branches',
  reports: 'Reports',
};

function usePageTitle(): string {
  const { pathname } = useLocation();
  const key = pathname.split('/').filter(Boolean)[1] ?? '';
  return TITLES[key] ?? 'Admin';
}

/** Slim glass top bar: mobile menu toggle, page title, store link, logout. */
export function AdminTopbar({ onMenu }: { onMenu: () => void }) {
  const title = usePageTitle();
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="glass sticky top-0 z-20 flex items-center gap-3 rounded-none px-4 py-3 sm:px-6">
      <button
        onClick={onMenu}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/60 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Visual echo of the page's own <h1> (from PageHeader). Hidden from the
          a11y tree so it neither duplicates the heading nor breaks heading order. */}
      <span aria-hidden="true" className="font-display text-lg font-bold">{title}</span>

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/"
          className="hidden items-center gap-1.5 rounded-full bg-white/50 px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:flex"
        >
          <ExternalLink size={15} /> View store
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:text-coral disabled:opacity-60"
        >
          {loggingOut ? <Spinner size={15} /> : <LogOut size={15} />}
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
