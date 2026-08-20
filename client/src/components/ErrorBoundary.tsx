import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable
 * Sunset-Glass fallback instead of a blank white screen. (React error
 * boundaries must be class components; Suspense does NOT catch render throws.)
 *
 * Placed at the app root and around each layout's <main>. Layout-level
 * boundaries are keyed by pathname, so navigating away via the still-mounted
 * nav clears the error without a full reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local visibility; a production build would forward this to a reporter.
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  private handleReload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-[60vh] place-items-center px-4 py-16">
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl brand-gradient text-white">
            <AlertTriangle size={22} />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-soft">
            An unexpected error interrupted this page. You can reload, or head back to the homepage.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-ink/5 p-3 text-left text-xs whitespace-pre-wrap text-coral">
              {error.message}
            </pre>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="rounded-full brand-gradient px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-transform hover:scale-[1.02] active:scale-95"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-full glass px-6 py-3 font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-95"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
