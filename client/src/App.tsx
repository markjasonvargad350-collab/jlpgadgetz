import { Routes, Route } from 'react-router-dom';
import { StoreLayout } from './layouts/StoreLayout';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Storefront route map. All public pages render inside the StoreLayout shell
 * (aurora background, sticky nav, footer). Admin routes arrive in Phase 8.
 */
function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<CatalogPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
        <Route path="/track-order" element={<TrackOrderPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
