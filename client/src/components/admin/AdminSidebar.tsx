import { Link, NavLink } from 'react-router-dom';
import { BarChart3, Boxes, LayoutDashboard, Package, ShoppingBag, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

/**
 * Inner content of the admin nav rail (brand · links · identity footer). Rendered
 * both in the sticky desktop aside and the mobile drawer (see AdminLayout).
 * `onNavigate` lets the drawer close itself when a link is tapped.
 */
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { admin } = useAdminAuth();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      {/* brand */}
      <Link to="/admin" onClick={onNavigate} className="flex items-center gap-2.5 px-2 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl brand-gradient text-white">
          <Sparkles size={18} />
        </span>
        <span className="font-display text-lg font-bold">
          iStore
          <span className="ml-1.5 rounded-full bg-white/70 px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide text-brand-700 uppercase">
            Admin
          </span>
        </span>
      </Link>

      {/* links */}
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-white/75 text-brand-700 shadow-sm' : 'text-ink-soft hover:bg-white/50 hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-brand-600' : ''} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* identity footer */}
      {admin && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/50 px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full brand-gradient text-sm font-bold text-white">
            {admin.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{admin.name}</p>
            <p className="truncate text-xs text-ink-soft">{admin.role}</p>
          </div>
        </div>
      )}
    </div>
  );
}
