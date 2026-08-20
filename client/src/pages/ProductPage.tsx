import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
  Zap,
} from 'lucide-react';
import { useProduct } from '../hooks/useProduct';
import { useCart } from '../contexts/CartContext';
import { formatPHP } from '../utils/format';
import type { ProductColor, ProductVariant } from '../types/api';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, loading, error, notFound } = useProduct(slug);
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [storage, setStorage] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Initialize selection to the first in-stock variant when the product loads.
  useEffect(() => {
    if (!product) return;
    const first = product.variants.find((v) => v.inStock) ?? product.variants[0];
    setStorage(first?.storage ?? null);
    setColor(first?.color ?? null);
    setActiveIndex(0);
    setQty(1);
  }, [product]);

  const storages = useMemo(() => uniqueStorages(product?.variants ?? []), [product]);
  const colors = useMemo(() => uniqueColors(product?.variants ?? []), [product]);

  if (loading) return <ProductSkeleton />;
  if (notFound || !product) return <ProductMissing />;
  if (error) {
    return (
      <div className={`${WIDTH} py-20 text-center`}>
        <p className="text-lg font-semibold">Couldn’t load this product</p>
        <p className="mt-1 text-sm text-ink-soft">{error}</p>
      </div>
    );
  }

  const variants = product.variants;
  const selected: ProductVariant | null =
    variants.find((v) => v.storage === storage && v.color === color) ?? null;

  const gallery = product.images;
  const mainSrc = gallery[activeIndex]?.url ?? selected?.image ?? gallery[0]?.url ?? null;
  const maxQty = Math.max(1, selected?.stock ?? 1);

  function selectStorage(s: string) {
    const match = variants.find((v) => v.storage === s && v.color === color) ?? variants.find((v) => v.storage === s);
    if (!match) return;
    setStorage(match.storage);
    setColor(match.color);
    setQty(1);
    setAdded(false);
  }

  function selectColor(c: string) {
    const match = variants.find((v) => v.color === c && v.storage === storage) ?? variants.find((v) => v.color === c);
    if (!match) return;
    setStorage(match.storage);
    setColor(match.color);
    setQty(1);
    setAdded(false);
  }

  function storageAvailable(s: string) {
    return variants.some((v) => v.storage === s && (color ? v.color === color : true) && v.inStock);
  }
  function colorAvailable(c: string) {
    return variants.some((v) => v.color === c && (storage ? v.storage === storage : true) && v.inStock);
  }

  function buildCartItem() {
    if (!selected || !product) return null;
    return {
      variantId: selected.id,
      productId: product.id,
      slug: product.slug,
      productName: product.name,
      variantLabel: `${selected.storage} · ${selected.color}`,
      colorHex: selected.colorHex,
      image: mainSrc,
      unitPrice: selected.price,
      quantity: qty,
      maxStock: selected.stock,
    };
  }

  function handleAdd() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    navigate('/cart');
  }

  const canBuy = !!selected && selected.inStock;

  return (
    <div className={`${WIDTH} pt-8`}>
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-ink-soft">
        <Link to="/" className="hover:text-brand-700">Home</Link>
        <ChevronRight size={14} />
        <Link to={`/shop?category=${product.categorySlug}`} className="hover:text-brand-700">
          {product.categoryName}
        </Link>
        <ChevronRight size={14} />
        <span className="truncate text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* gallery */}
        <div>
          <motion.div
            key={mainSrc ?? 'placeholder'}
            initial={{ opacity: 0.4, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="glass grid aspect-square place-items-center overflow-hidden rounded-3xl bg-white/50"
          >
            {mainSrc ? (
              <img src={mainSrc} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <Smartphone size={96} className="text-brand-300" />
            )}
          </motion.div>

          {gallery.length > 1 && (
            <div className="mt-3 flex gap-3">
              {gallery.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveIndex(i)}
                  className={`grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-white/50 transition-all ${
                    i === activeIndex ? 'ring-2 ring-brand-500' : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* details */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-ink-soft uppercase">{product.brand}</span>
            {product.isBestSeller && <Tag>Best Seller</Tag>}
            {product.isNewArrival && <Tag>New</Tag>}
            {product.discountPct > 0 && <Tag tone="deal">-{product.discountPct}%</Tag>}
          </div>

          <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{product.name}</h1>

          <p className="mt-4 font-display text-3xl font-extrabold text-gradient">
            {selected ? formatPHP(selected.price) : formatPHP(product.priceFrom)}
          </p>
          <StockLine variant={selected} />

          {/* storage */}
          {storages.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Storage</p>
              <div className="flex flex-wrap gap-2">
                {storages.map((s) => {
                  const isSel = s === storage;
                  const avail = storageAvailable(s);
                  return (
                    <button
                      key={s}
                      onClick={() => selectStorage(s)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-all ${
                        isSel
                          ? 'brand-gradient text-white shadow-sm'
                          : `glass text-ink hover:bg-white/80 ${avail ? '' : 'opacity-50'}`
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* color */}
          {colors.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">
                Color{color ? <span className="font-normal text-ink-soft"> · {color}</span> : null}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c) => {
                  const isSel = c.name === color;
                  const avail = colorAvailable(c.name);
                  return (
                    <button
                      key={c.name}
                      onClick={() => selectColor(c.name)}
                      title={c.name}
                      aria-label={c.name}
                      className={`grid h-9 w-9 place-items-center rounded-full transition-all ${
                        isSel ? 'ring-2 ring-brand-500 ring-offset-2' : avail ? '' : 'opacity-40'
                      }`}
                    >
                      <span
                        className="h-7 w-7 rounded-full border border-white/70 shadow-sm"
                        style={{ backgroundColor: c.hex ?? '#d6d3d1' }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* quantity + actions */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full glass p-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/70 disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/70 disabled:opacity-40"
                aria-label="Increase quantity"
              >
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={!canBuy}
              className="flex items-center gap-2 rounded-full glass px-6 py-3 font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {added ? <Check size={18} className="text-brand-600" /> : <ShoppingCart size={18} />}
              {added ? 'Added' : 'Add to cart'}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={!canBuy}
              className="flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap size={18} /> Buy now
            </button>
          </div>

          {!canBuy && (
            <p className="mt-3 text-sm font-medium text-coral">This option is currently sold out.</p>
          )}

          {/* reassurance */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-ink-soft">
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand-600" /> Genuine warranty</span>
            <span className="flex items-center gap-1.5"><Truck size={16} className="text-brand-600" /> Nationwide delivery</span>
          </div>

          {/* highlights */}
          {product.highlights.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-lg font-bold">Highlights</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* description */}
      {product.description && (
        <div className="glass mt-12 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">About the {product.name}</h2>
          <p className="mt-3 max-w-3xl text-ink-soft">{product.description}</p>
        </div>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function StockLine({ variant }: { variant: ProductVariant | null }) {
  if (!variant) return null;
  if (!variant.inStock) return <p className="mt-1 text-sm font-medium text-coral">Sold out</p>;
  if (variant.lowStock)
    return <p className="mt-1 text-sm font-medium text-amber">Only {variant.stock} left — order soon</p>;
  return <p className="mt-1 text-sm font-medium text-brand-700">In stock · ready to ship</p>;
}

function uniqueStorages(variants: ProductVariant[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of variants) {
    if (!seen.has(v.storage)) {
      seen.add(v.storage);
      out.push(v.storage);
    }
  }
  return out;
}

function uniqueColors(variants: ProductVariant[]): ProductColor[] {
  const seen = new Set<string>();
  const out: ProductColor[] = [];
  for (const v of variants) {
    if (!seen.has(v.color)) {
      seen.add(v.color);
      out.push({ name: v.color, hex: v.colorHex });
    }
  }
  return out;
}

function Tag({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'deal' }) {
  return (
    <span
      className={
        tone === 'deal'
          ? 'rounded-full bg-coral px-2.5 py-0.5 text-xs font-bold text-white'
          : 'rounded-full brand-gradient px-2.5 py-0.5 text-xs font-bold text-white'
      }
    >
      {children}
    </span>
  );
}

function ProductSkeleton() {
  return (
    <div className={`${WIDTH} pt-8`}>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="glass aspect-square animate-pulse rounded-3xl" />
        <div className="flex flex-col gap-4">
          <div className="glass h-6 w-24 animate-pulse rounded-full" />
          <div className="glass h-10 w-3/4 animate-pulse rounded-2xl" />
          <div className="glass h-8 w-40 animate-pulse rounded-2xl" />
          <div className="glass h-24 w-full animate-pulse rounded-3xl" />
          <div className="glass h-12 w-full animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ProductMissing() {
  return (
    <div className={`${WIDTH} py-24 text-center`}>
      <div className="glass mx-auto max-w-md rounded-3xl p-10">
        <Smartphone className="mx-auto text-brand-300" size={48} />
        <h1 className="mt-4 font-display text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This product may have been removed or is no longer available.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white"
        >
          Browse all products
        </Link>
      </div>
    </div>
  );
}
