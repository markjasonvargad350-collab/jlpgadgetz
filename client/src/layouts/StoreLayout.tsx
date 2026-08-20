import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { StoreNav } from '../components/store/StoreNav';
import { StoreFooter } from '../components/store/StoreFooter';

/** Public storefront shell: aurora background, sticky nav, footer. */
export function StoreLayout() {
  const { pathname } = useLocation();

  // Scroll to top on navigation.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="bg-aurora relative flex min-h-screen flex-col overflow-x-hidden">
      <StoreNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}
