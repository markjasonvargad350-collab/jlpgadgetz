import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Clock,
  Mail,
  MapPin,
  // lucide dropped its brand icons, so the Facebook link uses a neutral glyph.
  MessageCircle,
  Phone,
  RefreshCw,
  ShoppingBag,
  Star,
  Tags,
} from 'lucide-react';
import { useBranches } from '../hooks/useBranches';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatBranchLocation } from '../utils/format';
import { BUSINESS } from '../config/business';
import type { Branch } from '../types/api';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

/** What the shop does, straight from the logo badge: WE BUY · SELL · TRADE. */
const SERVICES = [
  {
    icon: <ShoppingBag size={20} />,
    title: 'We sell',
    body: 'Brand-new and pre-owned phones and gadgets, with the condition of every unit stated up front.',
    to: '/shop',
    cta: 'Browse the shop',
  },
  {
    icon: <Tags size={20} />,
    title: 'We buy',
    body: 'Selling your old device? Tell us about it online and our staff will inspect it and give you an offer.',
    to: '/trade-in',
    cta: 'Get an offer',
  },
  {
    icon: <RefreshCw size={20} />,
    title: 'We trade',
    body: 'Swap your current phone toward your next one, or pay it off monthly with an installment plan.',
    to: '/installment',
    cta: 'See installments',
  },
];

export function AboutPage() {
  useDocumentTitle('About & branches');
  const { data: branches, loading, error, reload } = useBranches();

  return (
    <div className={`${WIDTH} pt-10 pb-16`}>
      {/* ── Hero ── */}
      <section className="glass rounded-3xl p-8 sm:p-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <img
            src="/brand-logo.png"
            alt={BUSINESS.name}
            width={112}
            height={112}
            className="h-24 w-24 shrink-0 rounded-full object-contain sm:h-28 sm:w-28"
          />
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
              Est. 2018 · We buy · sell · trade
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{BUSINESS.name}</h1>
            <p className="mt-3 max-w-2xl text-ink-soft">{BUSINESS.tagline}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-brand-700">
              <Star size={14} className="fill-current" /> {BUSINESS.recommendation}
            </p>
          </div>
        </div>
      </section>

      {/* ── What we do ── */}
      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold">What we do</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="glass flex flex-col rounded-3xl p-6"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl brand-gradient text-white">
                {s.icon}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-ink-soft">{s.body}</p>
              <Link
                to={s.to}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                {s.cta} <ArrowRight size={14} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Branches ── */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Our branches</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Visit whichever branch is most convenient for you — the same catalog and prices apply at all of them.
        </p>

        {loading && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass h-44 animate-pulse rounded-3xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-coral"
            role="alert"
          >
            <span className="font-semibold">{error}</span>
            <button
              type="button"
              onClick={reload}
              className="rounded-full bg-coral px-4 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && branches.length === 0 && (
          <p className="glass mt-4 rounded-3xl p-6 text-sm text-ink-soft">
            Branch details are being updated. In the meantime, reach us on{' '}
            <a href={BUSINESS.phoneHref} className="font-semibold text-brand-700 hover:text-brand-800">
              {BUSINESS.phone}
            </a>
            .
          </p>
        )}

        {branches.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch, i) => (
              <BranchCard key={branch.id} branch={branch} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ── Contact ── */}
      <section className="glass mt-12 rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Get in touch</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ContactRow icon={<Phone size={18} />} label="Call or text">
            <a href={BUSINESS.phoneHref} className="font-semibold text-brand-700 hover:text-brand-800">
              {BUSINESS.phone}
            </a>
          </ContactRow>
          <ContactRow icon={<Mail size={18} />} label="Email">
            <a
              href={`mailto:${BUSINESS.email}`}
              className="font-semibold break-all text-brand-700 hover:text-brand-800"
            >
              {BUSINESS.email}
            </a>
          </ContactRow>
          <ContactRow icon={<MessageCircle size={18} />} label="Facebook">
            <a
              href={BUSINESS.facebookUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              {BUSINESS.facebookLabel}
            </a>
          </ContactRow>
          <ContactRow icon={<MapPin size={18} />} label="Main address" className="sm:col-span-2">
            <span className="text-ink-soft">{BUSINESS.mainAddress}</span>
          </ContactRow>
        </div>
      </section>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function BranchCard({ branch, index }: { branch: Branch; index: number }) {
  const location = formatBranchLocation(branch);
  const mapQuery = encodeURIComponent(
    [branch.addressLine, branch.city, branch.province, 'Philippines'].filter(Boolean).join(', '),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="glass flex flex-col rounded-3xl p-6"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{branch.name}</h3>
        {branch.isDefault && (
          <span className="shrink-0 rounded-full brand-gradient px-2.5 py-0.5 text-xs font-bold text-white">
            Main
          </span>
        )}
      </div>

      <dl className="mt-3 flex flex-1 flex-col gap-2 text-sm">
        {location && (
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 text-brand-600">
              <MapPin size={15} />
              <span className="sr-only">Address</span>
            </dt>
            <dd className="text-ink-soft">{location}</dd>
          </div>
        )}
        {branch.hours && (
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 text-brand-600">
              <Clock size={15} />
              <span className="sr-only">Opening hours</span>
            </dt>
            <dd className="text-ink-soft">{branch.hours}</dd>
          </div>
        )}
        {branch.phone && (
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 text-brand-600">
              <Phone size={15} />
              <span className="sr-only">Phone</span>
            </dt>
            <dd>
              <a href={`tel:${branch.phone.replace(/[\s-]/g, '')}`} className="text-brand-700 hover:text-brand-800">
                {branch.phone}
              </a>
            </dd>
          </div>
        )}
        {branch.email && (
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 text-brand-600">
              <Mail size={15} />
              <span className="sr-only">Email</span>
            </dt>
            <dd>
              <a href={`mailto:${branch.email}`} className="break-all text-brand-700 hover:text-brand-800">
                {branch.email}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {location && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Open in Maps <ArrowRight size={14} />
        </a>
      )}
    </motion.div>
  );
}

function ContactRow({
  icon,
  label,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 text-brand-600">
        {icon}
      </span>
      <div className="text-sm">
        <p className="font-semibold text-ink">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
