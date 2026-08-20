import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, ShoppingCart, Sparkles, X } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'iPhones', to: '/shop?category=iphone' },
  { label: 'Shop All', to: '/shop' },
  { label: 'Deals', to: '/shop?deal=true' },
];

export function StoreNav() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 mx-auto mt-4 w-[min(100%-1.5rem,76rem)]">
      <div className="flex items-center gap-3 rounded-full glass px-4 py-2.5 sm:gap-5 sm:px-5">
        {/* brand */}
        <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-xl brand-gradient text-white">
            <Sparkles size={18} />
          </span>
          <span className="hidden sm:inline">iStore</span>
        </Link>

        {/* desktop links */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.label}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/70 text-brand-700' : 'text-ink-soft hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* search (desktop) */}
        <form onSubmit={submitSearch} className="ml-auto hidden max-w-xs flex-1 items-center sm:flex">
          <div className="flex w-full items-center gap-2 rounded-full bg-white/60 px-3 py-1.5">
            <Search size={16} className="text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search iPhones…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
              aria-label="Search products"
            />
          </div>
        </form>

        {/* cart */}
        <Link
          to="/cart"
          className="relative ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/60 transition-colors hover:bg-white/80 sm:ml-0"
          aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
        >
          <ShoppingCart size={18} />
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full brand-gradient px-1 text-[11px] font-bold text-white"
              >
                {count}
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* mobile menu toggle */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/60 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* mobile sheet */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass mt-2 flex flex-col gap-1 rounded-3xl p-3 md:hidden"
          >
            <form onSubmit={submitSearch} className="mb-1 flex items-center gap-2 rounded-2xl bg-white/60 px-3 py-2">
              <Search size={16} className="text-ink-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search iPhones…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
                aria-label="Search products"
              />
            </form>
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-white/70 text-brand-700' : 'text-ink'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
