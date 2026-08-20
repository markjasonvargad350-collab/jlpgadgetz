import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

const WIDTH = 'mx-auto w-[min(100%-1.5rem,76rem)]';

export function NotFoundPage() {
  return (
    <div className={`${WIDTH} py-24 text-center`}>
      <div className="glass mx-auto max-w-md rounded-3xl p-10">
        <p className="font-display text-6xl font-extrabold text-gradient">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-ink-soft">The page you’re looking for doesn’t exist or has moved.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white"
        >
          <Home size={16} /> Back home
        </Link>
      </div>
    </div>
  );
}
