"use client";

import type { Dict } from "@/i18n/types";

export function TopicHeader({ t }: { t: Dict }) {
  return (
    <div className="mb-6 px-2 md:mb-8 md:px-0">
      <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
        {t.agentWatch.pageTitle}
      </h1>
      <p className="max-w-2xl text-base leading-relaxed text-white/55 md:text-lg">
        {t.agentWatch.pageSubtitle}
      </p>
      {t.agentWatch.pageHeroTagline && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45 md:text-base">
          {t.agentWatch.pageHeroTagline}
        </p>
      )}
    </div>
  );
}
