import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import type { ProductCard as ProductCardType } from '../types/api';
import { formatPriceRange } from '../utils/format';

/**
 * Frosted product card with warm hover glow. Links to the product detail page;
 * variant selection + add-to-cart happen there.
 */
export function ProductCard({ product }: { product: ProductCardType }) {
  const hasDiscount = product.discountPct > 0;

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="glass group flex flex-col overflow-hidden rounded-3xl p-4"
    >
      <Link to={`/product/${product.slug}`} className="flex flex-1 flex-col" aria-label={product.name}>
        {/* image */}
        <div className="relative mb-4 grid aspect-square place-items-center overflow-hidden rounded-2xl bg-white/50">
          {product.image ? (
            <img
              src={product.image}
              alt={product.imageAlt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <Smartphone size={64} className="text-brand-300" />
          )}

          {/* badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isBestSeller && <Badge>Best Seller</Badge>}
            {product.isNewArrival && <Badge>New</Badge>}
            {hasDiscount && <Badge tone="deal">-{product.discountPct}%</Badge>}
          </div>

          {!product.inStock && (
            <span className="absolute right-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">
              Sold out
            </span>
          )}
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col">
          <p className="text-xs font-medium tracking-wide text-ink-soft uppercase">{product.categoryName}</p>
          <h3 className="mt-1 font-display text-lg leading-snug font-bold">{product.name}</h3>

          {/* color swatches */}
          {product.colors.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              {product.colors.slice(0, 5).map((c) => (
                <span
                  key={c.name}
                  title={c.name}
                  className="h-4 w-4 rounded-full border border-white/70 shadow-sm"
                  style={{ backgroundColor: c.hex ?? '#d6d3d1' }}
                />
              ))}
              {product.colors.length > 5 && (
                <span className="text-xs text-ink-soft">+{product.colors.length - 5}</span>
              )}
            </div>
          )}

          <div className="mt-auto pt-4">
            <p className="text-xs text-ink-soft">From</p>
            <p className="font-display text-xl font-extrabold text-gradient">
              {formatPriceRange(product.priceFrom, product.priceTo)}
            </p>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function Badge({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'deal' }) {
  return (
    <span
      className={
        tone === 'deal'
          ? 'rounded-full bg-coral px-2.5 py-1 text-xs font-bold text-white shadow-sm'
          : 'rounded-full brand-gradient px-2.5 py-1 text-xs font-bold text-white shadow-sm'
      }
    >
      {children}
    </span>
  );
}
