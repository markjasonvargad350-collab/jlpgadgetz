import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, ShoppingCart, X } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'Trade-In', to: '/trade-in' },
  { label: 'Installment', to: '/installment' },
  { label: 'About', to: '/about' },
];

export function StoreNav() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
    setMenuOpen(false);
  }

  // Escape closes the mobile sheet and returns focus to the toggle button.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 mx-auto mt-4 w-[min(100%-1.5rem,76rem)]">
      <div className="flex items-center gap-3 rounded-full glass px-4 py-2.5 sm:gap-5 sm:px-5">
        {/* brand — the logo art is a circular badge on an opaque white square, so
            it's clipped to a circle and ringed to read as a deliberate mark. */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5 font-display text-base font-bold sm:text-lg">
          <img
            src="/brand-logo.png"
            alt="JLP Gadgetz Center logo"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-contain ring-1 ring-brand-100"
          />
          <span className="hidden sm:inline">JLP Gadgetz Center</span>
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
          <div className="flex w-full items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand-400">
            <Search size={16} className="text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phones & gadgets…"
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
          ref={menuButtonRef}
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
            <form onSubmit={submitSearch} className="mb-1 flex items-center gap-2 rounded-2xl bg-white/60 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-400">
              <Search size={16} className="text-ink-soft" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search phones & gadgets…"
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
