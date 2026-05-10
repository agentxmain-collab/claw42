import React from "react";

export function AIDisclaimer({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-relaxed text-white/55">
      {children}
    </p>
  );
}
