"use client";

import type { Dict } from "@/i18n/types";
import type { AnalysisSource } from "../types";

export function TopicHeader({
  t,
  source,
}: {
  t: Dict;
  source?: AnalysisSource;
}) {
  return (
    <div className="card-glow rounded-2xl border border-white/10 bg-[#111] p-6 md:p-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cw-green opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cw-green" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-cw-green">
          {t.agentWatch.pageTitle}
        </span>
        {source && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/45">
            {source}
          </span>
        )}
      </div>
      <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
        {t.agentWatch.pageSubtitle}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55 md:text-base">
        {t.agentWatch.pageHeroTagline}
      </p>
    </div>
  );
}
