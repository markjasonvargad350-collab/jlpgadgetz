import { Link } from 'react-router-dom';
// lucide dropped its brand icons, so the Facebook link uses a neutral glyph.
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { BUSINESS } from '../../config/business';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { label: 'All Products', to: '/shop' },
      { label: 'Deals', to: '/shop?deal=true' },
      { label: 'Trade-In', to: '/trade-in' },
      { label: 'Installment', to: '/installment' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About & Branches', to: '/about' },
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
          {/* brand + contact */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 font-display text-xl font-bold">
              <img
                src="/brand-logo.png"
                alt="JLP Gadgetz Center logo"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-contain ring-1 ring-brand-100"
              />
              {BUSINESS.name}
            </div>
            <p className="mt-3 max-w-sm text-sm text-ink-soft">
              {BUSINESS.tagline} Shop online without an account — pick the branch that’s most
              convenient for you.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <span>{BUSINESS.mainAddress}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="shrink-0 text-brand-600" />
                <a href={BUSINESS.phoneHref} className="transition-colors hover:text-brand-700">
                  {BUSINESS.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="shrink-0 text-brand-600" />
                <a href={`mailto:${BUSINESS.email}`} className="break-all transition-colors hover:text-brand-700">
                  {BUSINESS.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle size={16} className="shrink-0 text-brand-600" />
                <a
                  href={BUSINESS.facebookUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-brand-700"
                >
                  {BUSINESS.facebookLabel}
                </a>
              </li>
            </ul>
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
          <p>© {new Date().getFullYear()} {BUSINESS.name}. Prices in Philippine Peso (₱).</p>
          <p>Cash on Delivery · GCash · Bank Transfer</p>
        </div>
      </div>
    </footer>
  );
}
