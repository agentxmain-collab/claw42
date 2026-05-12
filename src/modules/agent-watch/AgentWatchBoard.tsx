"use client";

import { useCallback, useEffect, useState } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { useI18n } from "@/i18n/I18nProvider";
import { DispatchConsoleV9 } from "./v9/DispatchConsoleV9";
import { resolveAgentWatchLocale } from "./locale";
import { fallbackBeforeForPublicTimeline } from "./utils/publicTimelineWindow";

const PUBLIC_TIMELINE_MIN_ENTRIES = 30;
const PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES = 60;
const PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES = 720;

interface PublicTimelinePayload {
  events: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
  oldestTs: number | null;
  hasMore: boolean;
  windowMinutes: number;
  servedAt: number;
  nextPollMs?: number;
}

function mergeTimelineEvents(current: PublicTimelineEvent[], next: PublicTimelineEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next]
    .filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    })
    .sort((a, b) => b.ts - a.ts);
}

export function AgentWatchBoard() {
  const { locale } = useI18n();
  const agentWatchLocale = resolveAgentWatchLocale(locale);
  const [timelineEvents, setTimelineEvents] = useState<PublicTimelineEvent[]>([]);
  const [timelineEvidenceMap, setTimelineEvidenceMap] = useState<Record<string, NewsEvidence>>({});

  const applyTimelinePayload = useCallback(
    (payload: PublicTimelinePayload, mode: "replace" | "append") => {
      const sorted = payload.events.slice().sort((a, b) => b.ts - a.ts);
      setTimelineEvents((current) => (mode === "replace" ? sorted : mergeTimelineEvents(current, sorted)));
      if (payload.evidenceMap) {
        setTimelineEvidenceMap((current) =>
          mode === "replace" ? (payload.evidenceMap ?? {}) : { ...current, ...payload.evidenceMap },
        );
      }
    },
    [],
  );

  const fetchTimelineWindow = useCallback(
    async ({
      windowMinutes,
      before,
      limit = 100,
    }: {
      windowMinutes: number;
      before?: number | null;
      limit?: number;
    }) => {
      const params = new URLSearchParams({
        windowMinutes: String(windowMinutes),
        limit: String(limit),
        locale: agentWatchLocale,
      });
      if (before) params.set("before", String(before));
      const response = await fetch(`/api/watch/timeline?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`watch timeline ${response.status}`);
      return (await response.json()) as PublicTimelinePayload;
    },
    [agentWatchLocale],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      const primary = await fetchTimelineWindow({
        windowMinutes: PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES,
        limit: 100,
      });
      if (cancelled) return;
      applyTimelinePayload(primary, "replace");

      if (primary.events.length < PUBLIC_TIMELINE_MIN_ENTRIES) {
        const fallback = await fetchTimelineWindow({
          windowMinutes: PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES,
          before: fallbackBeforeForPublicTimeline(primary),
          limit: 100,
        });
        if (!cancelled) applyTimelinePayload(fallback, "append");
      }
    }

    loadTimeline().catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[claw42] public timeline fetch failed", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applyTimelinePayload, fetchTimelineWindow]);

  return (
    <DispatchConsoleV9
      events={timelineEvents}
      evidenceMap={timelineEvidenceMap}
      marketSnapshot={null}
    />
  );
}
