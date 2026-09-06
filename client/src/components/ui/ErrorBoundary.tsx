import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[synapse] render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-surface-0 p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-status-critical/15 text-2xl">💥</div>
          <h1 className="text-lg font-semibold text-ink-hi">Something broke in the dashboard UI</h1>
          <p className="max-w-md text-[13px] text-ink-mute">
            The rendering layer hit an unexpected error. The data connection is unaffected — reloading will
            re-hydrate from the server.
          </p>
          <pre className="max-w-lg overflow-x-auto rounded-md border border-surface-border bg-surface-1 p-3 text-left font-mono text-[11px] text-status-critical">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => location.reload()}
            className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-soft"
          >
            Reload dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
