"use client";

import type { Dict } from "@/i18n/types";

export function TopicHeader({ t }: { t: Dict }) {
  return (
    <div className="mb-6 px-2 md:mb-8 md:px-0">
      <div className="mb-3 flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b49cff] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7c5cff]" />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#b49cff]">
          {t.agentWatch.pageTitle}
        </span>
      </div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
        {t.agentWatch.pageSubtitle}
      </h1>
      {t.agentWatch.pageHeroTagline && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60 md:text-base">
          {t.agentWatch.pageHeroTagline}
        </p>
      )}
    </div>
  );
}
