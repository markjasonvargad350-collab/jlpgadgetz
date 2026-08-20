import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Minus, Plus, ShoppingBag, Smartphone, Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { formatPHP } from '../utils/format';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

export function CartPage() {
  const { items, subtotal, count, setQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className={`${WIDTH} py-24 text-center`}>
        <div className="glass mx-auto max-w-md rounded-3xl p-10">
          <ShoppingBag className="mx-auto text-brand-300" size={48} />
          <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-ink-soft">Browse the lineup and add something you love.</p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white"
          >
            Start shopping <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`${WIDTH} pt-10`}>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Your cart</h1>
      <p className="mt-1 text-sm text-ink-soft">{count} item{count === 1 ? '' : 's'}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* lines */}
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.variantId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="glass flex gap-4 rounded-3xl p-4"
              >
                <Link
                  to={`/product/${item.slug}`}
                  className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/50"
                >
                  {item.image ? (
                    <img src={item.image} alt={item.productName} className="h-full w-full object-cover" />
                  ) : (
                    <Smartphone size={32} className="text-brand-300" />
                  )}
                </Link>

                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/product/${item.slug}`} className="font-display font-bold hover:text-brand-700">
                        {item.productName}
                      </Link>
                      <p className="text-sm text-ink-soft">{item.variantLabel}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white/70 hover:text-coral"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <div className="flex items-center gap-1 rounded-full bg-white/60 p-1">
                      <button
                        onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/80"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/80 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="font-display font-bold text-gradient">{formatPHP(item.unitPrice * item.quantity)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <Link to="/shop" className="mt-1 flex items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 transition-all">
            Continue shopping <ArrowRight size={15} />
          </Link>
        </div>

        {/* summary */}
        <aside className="glass h-fit rounded-3xl p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="font-semibold">{formatPHP(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className="text-ink-soft">Calculated at checkout</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between border-t border-white/60 pt-4">
            <span className="font-display font-bold">Total</span>
            <span className="font-display text-xl font-extrabold text-gradient">{formatPHP(subtotal)}</span>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95"
          >
            Proceed to checkout <ArrowRight size={16} />
          </button>
          <p className="mt-3 text-center text-xs text-ink-soft">
            Guest checkout — no account required. Final price is confirmed securely at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
