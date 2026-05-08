"use client";

import { useEffect, useState } from "react";
import { reportError } from "@/lib/observability/error-reporter";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    setErrorId(
      reportError(error, {
        surface: "next_locale_error",
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="text-center">
        <p className="mb-4 font-mono text-sm text-[#ff5f5f]">
          Something went wrong
        </p>
        <h1 className="mb-4 text-2xl font-bold text-white md:text-3xl">
          We hit a snag
        </h1>
        <p className="mb-8 text-gray-400">
          An unexpected error occurred. Share this error ID with Dan if it repeats.
        </p>
        <p className="mb-8 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white/70">
          Error ID: {errorId ?? "reporting"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-xl bg-[#7c5cff] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#8e6bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1ff55]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
