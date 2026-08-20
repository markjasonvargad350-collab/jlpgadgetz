import { Link } from 'react-router-dom';
import { MapPin, PackageSearch } from 'lucide-react';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

/**
 * Placeholder for order tracking. Real order lookup + the simulated delivery
 * map (clearly labelled as simulated — we don't fake GPS) arrive alongside
 * checkout and the delivery phase.
 */
export function TrackOrderPage() {
  return (
    <div className={`${WIDTH} py-16`}>
      <div className="glass mx-auto max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl brand-gradient text-white">
          <PackageSearch size={26} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold">Track your order</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Once you place an order you’ll receive an order number. Order lookup and a live delivery
          timeline with a simulated map are coming with checkout.
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-full bg-white/60 px-4 py-3 text-left opacity-60">
          <MapPin size={18} className="text-ink-soft" />
          <input
            disabled
            placeholder="e.g. ORD-20260820-0001"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-soft"
            aria-label="Order number (coming soon)"
          />
        </div>

        <Link
          to="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
