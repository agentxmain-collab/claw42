"use client";

import { useEffect, useState } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { apiPath } from "@/lib/basePath";
import type { AgentWatchLocale } from "@/modules/agent-watch/locale";
import { buildHeroAnalysisBriefFromEvents, type HeroAnalysisBrief } from "./heroAnalysisBrief";

interface WatchTimelinePayload {
  events?: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
}

const HERO_ANALYSIS_BRIEF_REFRESH_MS = 90_000;

function timelineUrl(locale: AgentWatchLocale) {
  const query = new URLSearchParams({
    locale,
    page: "1",
  });
  return apiPath(`/api/watch/timeline?${query.toString()}` as `/api/${string}`);
}

async function loadHeroAnalysisBrief(locale: AgentWatchLocale, signal: AbortSignal) {
  const response = await fetch(timelineUrl(locale), {
    signal,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as WatchTimelinePayload;
  return buildHeroAnalysisBriefFromEvents({
    events: Array.isArray(payload.events) ? payload.events : [],
    evidenceMap: payload.evidenceMap,
    locale,
  });
}

export function useHeroAnalysisBrief(locale: AgentWatchLocale): HeroAnalysisBrief | null {
  const [brief, setBrief] = useState<HeroAnalysisBrief | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const refresh = async () => {
      const nextBrief = await loadHeroAnalysisBrief(locale, controller.signal).catch(() => null);
      if (active) setBrief(nextBrief);
    };

    void refresh();
    const intervalId = window.setInterval(refresh, HERO_ANALYSIS_BRIEF_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [locale]);

  return brief;
}
