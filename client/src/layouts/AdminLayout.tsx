import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminTopbar } from '../components/admin/AdminTopbar';
import { Spinner } from '../components/admin/ui/Spinner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { SPRING_EASE } from '../utils/motion';

/**
 * Admin shell: a sticky glass nav rail on the left (desktop) that collapses into
 * an animated drawer on mobile, a slim glass top bar, and the routed page.
 */
export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const drawerRef = useFocusTrap<HTMLElement>(menuOpen);

  // Scroll to top + close the mobile drawer on every navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes the mobile drawer (focus is trapped inside it while open).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="bg-aurora relative flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-brand-600 focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        Skip to main content
      </a>

      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 p-3 lg:block">
        <div className="glass h-full rounded-3xl">
          <AdminSidebar />
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenu={() => setMenuOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
          {/* Each admin page is its own lazy chunk; this boundary keeps the rail
              + top bar mounted and shows a content-area spinner while the next
              page chunk loads (the full-page splash only fires on first entry).
              The ErrorBoundary (keyed by pathname) sits outside Suspense so it
              also catches a failed chunk load, and clears on navigation. */}
          <ErrorBoundary key={pathname}>
            <Suspense
              fallback={
                <div className="grid place-items-center py-24">
                  <Spinner size={26} />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm lg:hidden"
              aria-hidden
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: SPRING_EASE }}
              className="fixed inset-y-0 left-0 z-50 w-72 p-3 lg:hidden"
            >
              <div className="glass h-full rounded-3xl">
                <AdminSidebar onNavigate={() => setMenuOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
