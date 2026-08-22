import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { StoreLayout } from './layouts/StoreLayout';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { RequireAuth } from './routes/RequireAuth';
import { Spinner, PageLoader } from './components/admin/ui/Spinner';

// Eager, above: the three pages a visitor can land on cold from Google, a
// Facebook link or a QR code — home, the catalogue and a product. Splitting
// those would only add a round-trip to the most common first paint.
//
// Lazy, below: everything a visitor reaches by clicking something, by which
// point the chunk fetches against a warm connection. Keeps the pages nobody
// visits on a browse-only session (checkout, trade-in, installments, tracking)
// out of the entry bundle.
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() =>
  import('./pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage })),
);
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })));
const TradeInPage = lazy(() => import('./pages/TradeInPage').then((m) => ({ default: m.TradeInPage })));
const InstallmentPage = lazy(() => import('./pages/InstallmentPage').then((m) => ({ default: m.InstallmentPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

// The entire admin back-office is code-split behind React.lazy: it sits behind
// session auth and is never reached by storefront visitors, so deferring it
// keeps the initial customer bundle lean — Recharts (the ~360 kB charts chunk),
// Leaflet, and the admin shell all leave the entry and load only once someone
// navigates to /admin. Named exports are mapped to `default` for lazy().
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const LoginPage = lazy(() => import('./pages/admin/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductsPage = lazy(() => import('./pages/admin/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const ProductEditPage = lazy(() => import('./pages/admin/ProductEditPage').then((m) => ({ default: m.ProductEditPage })));
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const OrdersPage = lazy(() => import('./pages/admin/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import('./pages/admin/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })));
const TradeInsPage = lazy(() => import('./pages/admin/TradeInsPage').then((m) => ({ default: m.TradeInsPage })));
const TradeInDetailPage = lazy(() =>
  import('./pages/admin/TradeInDetailPage').then((m) => ({ default: m.TradeInDetailPage })),
);
const InstallmentsPage = lazy(() =>
  import('./pages/admin/InstallmentsPage').then((m) => ({ default: m.InstallmentsPage })),
);
const InstallmentDetailPage = lazy(() =>
  import('./pages/admin/InstallmentDetailPage').then((m) => ({ default: m.InstallmentDetailPage })),
);
const BranchesPage = lazy(() => import('./pages/admin/BranchesPage').then((m) => ({ default: m.BranchesPage })));
const BranchEditPage = lazy(() => import('./pages/admin/BranchEditPage').then((m) => ({ default: m.BranchEditPage })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })));

/** Fallback for a storefront chunk in flight. Deliberately not `PageLoader`,
 *  which is `min-h-screen`: this renders *inside* StoreLayout, below a nav that
 *  is already painted, so a full-viewport spinner would push the footer off. */
function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner size={24} />
    </div>
  );
}

/**
 * Route map. Public pages render inside StoreLayout; the admin subtree lives
 * under a pathless AdminAuthProvider wrapper (so the storefront never probes
 * the session) with RequireAuth gating everything past /admin/login.
 */
function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<CatalogPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />

        {/* The lazy storefront pages share one Suspense boundary nested inside
            StoreLayout, so the nav and footer stay on screen while a route
            chunk downloads instead of the whole shell flashing. */}
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          }
        >
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
          <Route path="/track-order" element={<TrackOrderPage />} />
          <Route path="/trade-in" element={<TradeInPage />} />
          <Route path="/installment" element={<InstallmentPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route
        element={
          <AdminAuthProvider>
            <Suspense fallback={<PageLoader label="Loading admin…" />}>
              <Outlet />
            </Suspense>
          </AdminAuthProvider>
        }
      >
        <Route path="/admin/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderNumber" element={<OrderDetailPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductEditPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="trade-ins" element={<TradeInsPage />} />
            <Route path="trade-ins/:id" element={<TradeInDetailPage />} />
            <Route path="installments" element={<InstallmentsPage />} />
            <Route path="installments/:id" element={<InstallmentDetailPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="branches/new" element={<BranchEditPage />} />
            <Route path="branches/:id" element={<BranchEditPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
