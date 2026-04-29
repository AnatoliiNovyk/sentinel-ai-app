import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional: custom fallback UI. Receives error + reset function. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional: label shown in the error panel (e.g. "Dashboard") */
  context?: string;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary — catches unhandled render errors in any child subtree.
 *
 * Usage:
 *   <ErrorBoundary context="Dashboard">
 *     <Dashboard />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={(err, reset) => <MyError error={err} onReset={reset} />}>
 *     ...
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console with component stack for debugging
    console.error(`[ErrorBoundary${this.props.context ? ` / ${this.props.context}` : ''}]`, error, info.componentStack);
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    const { children, fallback, context } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    return (
      <div className="min-h-[300px] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-xl p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>

          <div>
            <p className="text-slate-200 font-semibold text-lg">
              {context ? `${context} encountered an error` : 'Something went wrong'}
            </p>
            <p className="text-slate-500 text-sm mt-1">{error.message}</p>
          </div>

          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
