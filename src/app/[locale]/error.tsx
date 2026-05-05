"use client";

import { useEffect } from "react";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="text-center">
        <p className="mb-4 font-mono text-sm text-[#ff5f5f]">Something went wrong</p>
        <h1 className="mb-4 text-2xl font-bold text-white md:text-3xl">We hit a snag</h1>
        <p className="mb-8 text-gray-400">An unexpected error occurred. Try reloading.</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-xl bg-[#7c5cff] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#8e6bff]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
