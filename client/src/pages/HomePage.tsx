import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  CreditCard,
  Headphones,
  PackageSearch,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { ProductGrid } from '../components/store/ProductGrid';
import { SectionHeading } from '../components/store/SectionHeading';
import type { ProductListParams } from '../types/api';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

const CATEGORY_ICON: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  iphone: Smartphone,
  airpods: Headphones,
  chargers: Zap,
  cases: ShieldCheck,
};

export function HomePage() {
  return (
    <div className="flex flex-col gap-16 pb-4">
      <Hero />
      <TrustStrip />
      <ShopByCategory />
      <CatalogSection title="Featured" subtitle="Hand-picked highlights from the lineup." params={{ featured: true }} />
      <CatalogSection title="Best sellers" subtitle="What everyone’s buying right now." params={{ bestSeller: true }} />
      <CatalogSection title="New arrivals" subtitle="The latest to land in store." params={{ newArrival: true }} />
      <CatalogSection title="Today’s deals" subtitle="Limited-time savings." params={{ deal: true }} hideWhenEmpty />
      <WhyUs />
      <Reviews />
      <Faq />
    </div>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className={`${WIDTH} flex flex-col items-center gap-8 pt-14 text-center sm:pt-20`}>
      <motion.span
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-full glass px-4 py-1.5 text-xs font-semibold tracking-widest text-brand-700 uppercase"
      >
        <Sparkles size={13} className="mr-1.5 inline" /> Premium iPhones · Guest checkout
      </motion.span>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        className="max-w-3xl text-5xl leading-[1.05] font-extrabold sm:text-7xl"
      >
        Discover Your Next <span className="text-gradient">iPhone</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="max-w-xl text-lg text-ink-soft"
      >
        A premium, glassy iPhone store with guest checkout, genuine warranties, and nationwide
        delivery. No account needed — shop in minutes.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.18 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          to="/shop?category=iphone"
          className="flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Smartphone size={18} /> Shop iPhones
        </Link>
        <Link
          to="/track-order"
          className="flex items-center gap-2 rounded-full glass px-6 py-3 font-semibold text-ink transition-transform hover:scale-[1.03] active:scale-95"
        >
          <PackageSearch size={18} /> Track Order
        </Link>
      </motion.div>
    </section>
  );
}

/* ── Trust strip ─────────────────────────────────────────────────────────── */

const TRUST = [
  { icon: Truck, label: 'Nationwide delivery' },
  { icon: ShieldCheck, label: 'Genuine warranty' },
  { icon: CreditCard, label: 'COD · GCash · Bank' },
  { icon: Sparkles, label: 'No account needed' },
];

function TrustStrip() {
  return (
    <section className={WIDTH}>
      <div className="glass grid grid-cols-2 gap-2 rounded-3xl p-3 sm:grid-cols-4">
        {TRUST.map((t) => (
          <div key={t.label} className="flex items-center justify-center gap-2 px-3 py-2 text-center">
            <t.icon size={18} className="shrink-0 text-brand-600" />
            <span className="text-sm font-medium text-ink">{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Shop by category ────────────────────────────────────────────────────── */

function ShopByCategory() {
  const { data, loading } = useCategories();

  return (
    <section className={WIDTH}>
      <SectionHeading title="Shop by category" subtitle="Find exactly what you’re after." />
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-32 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {data.map((c) => {
            const Icon = CATEGORY_ICON[c.slug] ?? Smartphone;
            return (
              <Link
                key={c.id}
                to={`/shop?category=${c.slug}`}
                className="glass group flex flex-col justify-between rounded-3xl p-5 transition-transform hover:-translate-y-1"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl brand-gradient text-white">
                  <Icon size={22} />
                </span>
                <div className="mt-6">
                  <h3 className="font-display text-lg font-bold">{c.name}</h3>
                  <p className="text-xs text-ink-soft">{c.productCount} products</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Reusable product rail ───────────────────────────────────────────────── */

function CatalogSection({
  title,
  subtitle,
  params,
  hideWhenEmpty = false,
}: {
  title: string;
  subtitle: string;
  params: ProductListParams;
  hideWhenEmpty?: boolean;
}) {
  const { data, loading, error } = useProducts({ ...params, pageSize: 8, sort: 'newest' });
  const items = data?.items ?? [];

  if (hideWhenEmpty && !loading && !error && items.length === 0) return null;

  // Build a "See all" link that mirrors this rail's filter.
  const linkParams = new URLSearchParams();
  if (params.featured) linkParams.set('featured', 'true');
  if (params.bestSeller) linkParams.set('bestSeller', 'true');
  if (params.newArrival) linkParams.set('newArrival', 'true');
  if (params.deal) linkParams.set('deal', 'true');
  const seeAll = `/shop${linkParams.toString() ? `?${linkParams}` : ''}`;

  return (
    <section className={WIDTH}>
      <SectionHeading
        title={title}
        subtitle={subtitle}
        action={
          <Link
            to={seeAll}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 transition-all"
          >
            See all <ArrowRight size={15} />
          </Link>
        }
      />
      <ProductGrid products={items.slice(0, 4)} loading={loading} error={error} skeletonCount={4} />
    </section>
  );
}

/* ── Why us ──────────────────────────────────────────────────────────────── */

const WHY = [
  { icon: ShieldCheck, title: '100% genuine', body: 'Every device is authentic and sealed, backed by a manufacturer warranty.' },
  { icon: Truck, title: 'Fast delivery', body: 'Nationwide shipping with live, transparent order tracking end to end.' },
  { icon: CreditCard, title: 'Flexible payment', body: 'Pay your way — Cash on Delivery, GCash, or bank transfer at checkout.' },
  { icon: Sparkles, title: 'No account needed', body: 'Check out as a guest in minutes. Your details are never stored for ads.' },
];

function WhyUs() {
  return (
    <section className={WIDTH}>
      <SectionHeading title="Why shop with us" subtitle="A premium experience, end to end." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WHY.map((w) => (
          <div key={w.title} className="glass rounded-3xl p-6">
            <span className="grid h-11 w-11 place-items-center rounded-2xl brand-gradient text-white">
              <w.icon size={22} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold">{w.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{w.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Reviews (sample testimonials for the demo) ──────────────────────────── */

const REVIEWS = [
  { name: 'Andrea R.', location: 'Quezon City', text: 'Ordered the 15 Pro Max on COD and it arrived the next day. The tracking map was a nice touch!' },
  { name: 'Miguel S.', location: 'Cebu', text: 'Paid with GCash, super smooth. Phone was sealed and genuine. Will buy again.' },
  { name: 'Joy L.', location: 'Davao', text: 'Loved that I didn’t need an account. Checkout took two minutes. Highly recommend.' },
];

function Reviews() {
  return (
    <section className={WIDTH}>
      <SectionHeading title="What customers say" subtitle="Sample reviews from happy shoppers." />
      <div className="grid gap-4 md:grid-cols-3">
        {REVIEWS.map((r) => (
          <div key={r.name} className="glass flex flex-col rounded-3xl p-6">
            <div className="flex gap-0.5 text-amber">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} className="fill-amber text-amber" />
              ))}
            </div>
            <p className="mt-3 flex-1 text-sm text-ink">“{r.text}”</p>
            <p className="mt-4 text-sm font-semibold">{r.name}</p>
            <p className="text-xs text-ink-soft">{r.location}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */

const FAQS = [
  { q: 'Do I need an account to buy?', a: 'No. You can check out as a guest — just enter your delivery and contact details at checkout.' },
  { q: 'What payment methods can I use?', a: 'Cash on Delivery, GCash, and bank transfer. You choose your method during checkout.' },
  { q: 'How do I track my order?', a: 'After ordering you’ll get an order number. Use the Track Order page to follow its status and delivery.' },
  { q: 'Are the products genuine?', a: 'Yes — all devices are authentic, sealed, and covered by the manufacturer’s warranty.' },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className={WIDTH}>
      <SectionHeading title="Frequently asked" subtitle="Everything you need to know before you buy." />
      <div className="flex flex-col gap-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="glass overflow-hidden rounded-3xl">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-display font-bold">{f.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-brand-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-5 text-sm text-ink-soft">{f.a}</p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
