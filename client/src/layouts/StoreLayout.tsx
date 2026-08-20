import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { StoreNav } from '../components/store/StoreNav';
import { StoreFooter } from '../components/store/StoreFooter';
import { ErrorBoundary } from '../components/ErrorBoundary';

/** Public storefront shell: aurora background, sticky nav, footer. */
export function StoreLayout() {
  const { pathname } = useLocation();

  // Scroll to top on navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="bg-aurora relative flex min-h-screen flex-col overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-brand-600 focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        Skip to main content
      </a>
      <StoreNav />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* Keyed by pathname so navigating away via the nav clears any page error. */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <StoreFooter />
    </div>
  );
}
