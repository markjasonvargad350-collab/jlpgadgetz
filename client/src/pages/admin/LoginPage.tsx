import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ApiError } from '../../services/http';
import { Field, Input } from '../../components/admin/ui/Field';
import { PageLoader, Spinner } from '../../components/admin/ui/Spinner';

/** Standalone admin sign-in (no shell). Redirects an already-authed admin. */
export function LoginPage() {
  const { admin, loading, login } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wait for the session probe, then bounce authed admins straight through.
  if (loading) return <PageLoader label="Checking your session…" />;
  if (admin) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-aurora grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl brand-gradient text-white shadow-lg shadow-brand-600/25">
              <Sparkles size={26} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-extrabold">iStore Admin</h1>
            <p className="mt-1 text-sm text-ink-soft">Sign in to manage orders, stock &amp; reports.</p>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-2 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral ring-1 ring-coral/20">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@istore.test"
                  className="pl-10"
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft" />
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="px-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft hover:text-ink"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
            >
              {submitting ? <Spinner size={18} tone="light" /> : null}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <Link
          to="/"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Back to store
        </Link>
      </div>
    </div>
  );
}
