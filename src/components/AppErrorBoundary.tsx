"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/observability/error-reporter";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorId: string | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorId: null,
  };

  static getDerivedStateFromError(): Pick<AppErrorBoundaryState, "hasError"> {
    return { hasError: true };
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = reportError(error, {
      surface: "react_render",
      componentStack: errorInfo.componentStack,
    });
    this.setState({ errorId });
  }

  private handleWindowError = (event: ErrorEvent) => {
    reportError(event.error ?? event.message, {
      surface: "window_error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportError(event.reason, { surface: "unhandled_rejection" });
  };

  private reset = () => {
    this.setState({ hasError: false, errorId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return <ErrorFallback errorId={this.state.errorId} onReset={this.reset} />;
  }
}

function ErrorFallback({
  errorId,
  onReset,
}: {
  errorId: string | null;
  onReset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6 text-center shadow-2xl">
        <p className="mb-3 font-mono text-sm text-[#ff5f5f]">Application error</p>
        <h1 className="mb-3 text-2xl font-bold md:text-3xl">Something broke</h1>
        <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-white/65">
          Refresh and try again. If this keeps happening, share the error ID with Dan.
        </p>
        <p className="mb-6 rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-xs text-white/75">
          Error ID: {errorId ?? "reporting"}
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl bg-[#7c5cff] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#8e6bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1ff55]"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1ff55]"
          >
            Back home
          </a>
        </div>
      </section>
    </main>
  );
}
