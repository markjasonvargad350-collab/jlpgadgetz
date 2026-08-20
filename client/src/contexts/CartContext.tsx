import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem } from '../types/cart';

const STORAGE_KEY = 'istore_cart_v1';

interface CartContextValue {
  items: CartItem[];
  /** Total quantity across all lines (for the nav badge). */
  count: number;
  /** Sum of unitPrice × quantity (display only). */
  subtotal: number;
  /** Merge by variant, summing quantity and clamping to the stock snapshot. */
  addItem: (item: CartItem) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
  isInCart: (variantId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Safely load the persisted cart; tolerate corrupt/absent storage. */
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Shallow shape guard — drop anything that isn't a well-formed line.
    return parsed.filter(
      (i): i is CartItem =>
        !!i &&
        typeof i === 'object' &&
        typeof (i as CartItem).variantId === 'string' &&
        typeof (i as CartItem).quantity === 'number',
    );
  } catch {
    return [];
  }
}

function clampQty(qty: number, max: number): number {
  const ceiling = max > 0 ? max : 1;
  return Math.max(1, Math.min(Math.floor(qty), ceiling));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable — cart simply won't persist */
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: clampQty(i.quantity + item.quantity, item.maxStock), maxStock: item.maxStock }
            : i,
        );
      }
      return [...prev, { ...item, quantity: clampQty(item.quantity, item.maxStock) }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.variantId !== variantId);
      return prev.map((i) =>
        i.variantId === variantId ? { ...i, quantity: clampQty(quantity, i.maxStock) } : i,
      );
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return {
      items,
      count,
      subtotal,
      addItem,
      setQuantity,
      removeItem,
      clear,
      isInCart: (variantId: string) => items.some((i) => i.variantId === variantId),
    };
  }, [items, addItem, setQuantity, removeItem, clear]);

  return <CartContext value={value}>{children}</CartContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
