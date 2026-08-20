import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', to: '/shop' },
      { label: 'iPhones', to: '/shop?category=iphone' },
      { label: 'AirPods', to: '/shop?category=airpods' },
      { label: 'Chargers & Cables', to: '/shop?category=chargers' },
      { label: 'Cases & Protection', to: '/shop?category=cases' },
      { label: 'Deals', to: '/shop?deal=true' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Track Order', to: '/track-order' },
      { label: 'Cart', to: '/cart' },
    ],
  },
];

export function StoreFooter() {
  return (
    <footer className="mx-auto mt-16 w-[min(100%-1.5rem,76rem)] pb-10">
      <div className="glass rounded-3xl px-6 py-10 sm:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-xl brand-gradient text-white">
                <Sparkles size={18} />
              </span>
              iStore
            </div>
            <p className="mt-3 max-w-sm text-sm text-ink-soft">
              A premium iPhone store with guest checkout, genuine warranties, and nationwide
              delivery. Buy without an account — checkout in minutes.
            </p>
            <p className="mt-4 text-xs text-ink-soft">
              Prices in Philippine Peso (₱). Product images are placeholders for this demo.
            </p>
          </div>

          {/* link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-sm font-bold tracking-wide uppercase">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-ink-soft transition-colors hover:text-brand-700">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-white/60 pt-6 text-xs text-ink-soft sm:flex-row">
          <p>© {new Date().getFullYear()} iStore. Built with the Sunset Glass design system.</p>
          <p>Cash on Delivery · GCash · Bank Transfer</p>
        </div>
      </div>
    </footer>
  );
}
