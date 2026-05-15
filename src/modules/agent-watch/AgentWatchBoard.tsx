"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { apiPath } from "@/lib/basePath";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  mapPublicTimelineEventsToTopics,
  type FollowStatsSnapshot,
} from "@/lib/watch/v9TopicAdapter";
import { useI18n } from "@/i18n/I18nProvider";
import { DispatchConsoleV9 } from "./v9/DispatchConsoleV9";
import type {
  DispatchConsoleV9Props,
  DispatchTopic,
  DispatchTopicAction,
  DispatchView,
} from "./v9/types";
import { resolveAgentWatchLocale } from "./locale";
import { fallbackBeforeForPublicTimeline } from "./utils/publicTimelineWindow";

const PUBLIC_TIMELINE_MIN_ENTRIES = 30;
const PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES = 60;
const PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES = 720;
const DEFAULT_TIMELINE_POLL_MS = 90_000;
const TIMELINE_STREAM_RETRY_MS = 30_000;
const TIMELINE_HIDDEN_POLL_MS = 5 * 60_000;
const FOLLOW_STATS_VISIBLE_POLL_MS = 60_000;
const FOLLOW_STATS_MARKET_POLL_MS = 30_000;
const FOLLOW_STATS_HIDDEN_POLL_MS = 5 * 60_000;
const FOLLOW_STATS_BROADCAST = "claw42-follow-stats";
const FOLLOW_STATS_STORAGE_EVENT = "claw42-follow-stats-updated";

interface PublicTimelinePayload {
  events: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
  oldestTs: number | null;
  hasMore: boolean;
  windowMinutes: number;
  servedAt: number;
  nextPollMs?: number;
}

interface FollowStatsPayload {
  stats: Record<string, FollowStatsSnapshot>;
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

export function AgentWatchBoard({
  console: Console = DispatchConsoleV9,
  initialView = "mkt",
}: {
  console?: ComponentType<DispatchConsoleV9Props>;
  initialView?: DispatchView;
}) {
  const { locale, t } = useI18n();
  const agentWatchLocale = resolveAgentWatchLocale(locale);
  const outcomeDict = t.agentWatch.dispatchV10.outcome;
  const roundDict = t.agentWatch.dispatchV10.round;
  const stageStatusDict = t.agentWatch.dispatchV10.stageStatus;
  const topicRankingDict = t.agentWatch.dispatchV10.topicRanking;
  const [timelineEvents, setTimelineEvents] = useState<PublicTimelineEvent[]>([]);
  const [timelineEvidenceMap, setTimelineEvidenceMap] = useState<Record<string, NewsEvidence>>({});
  const [followStatsByRecordId, setFollowStatsByRecordId] = useState<
    Record<string, FollowStatsSnapshot>
  >({});
  const [activeDispatchView, setActiveDispatchView] = useState<DispatchView>(initialView);
  const nextTimelinePollMsRef = useRef(DEFAULT_TIMELINE_POLL_MS);

  const applyTimelinePayload = useCallback(
    (payload: PublicTimelinePayload, mode: "replace" | "append") => {
      const sorted = payload.events.slice().sort((a, b) => b.ts - a.ts);
      setTimelineEvents((current) =>
        mode === "replace" ? sorted : mergeTimelineEvents(current, sorted),
      );
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
      signal,
    }: {
      windowMinutes: number;
      before?: number | null;
      limit?: number;
      signal?: AbortSignal;
    }) => {
      const params = new URLSearchParams({
        windowMinutes: String(windowMinutes),
        limit: String(limit),
        locale: agentWatchLocale,
      });
      if (before) params.set("before", String(before));
      const response = await fetch(apiPath(`/api/watch/timeline?${params}`), {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error(`watch timeline ${response.status}`);
      return (await response.json()) as PublicTimelinePayload;
    },
    [agentWatchLocale],
  );

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let controller: AbortController | null = null;
    let eventSource: EventSource | null = null;

    function clearTimers() {
      if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function closeEventSource() {
      eventSource?.close();
      eventSource = null;
    }

    function currentTimelinePollMs() {
      return document.visibilityState === "hidden"
        ? TIMELINE_HIDDEN_POLL_MS
        : nextTimelinePollMsRef.current;
    }

    async function appendTimelineFallback(primary: PublicTimelinePayload, signal: AbortSignal) {
      if (primary.events.length >= PUBLIC_TIMELINE_MIN_ENTRIES) return;
      const fallback = await fetchTimelineWindow({
        windowMinutes: PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES,
        before: fallbackBeforeForPublicTimeline(primary),
        limit: 100,
        signal,
      });
      if (!cancelled) applyTimelinePayload(fallback, "append");
    }

    async function loadTimeline() {
      controller?.abort();
      controller = new AbortController();

      try {
        const primary = await fetchTimelineWindow({
          windowMinutes: PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES,
          limit: 100,
          signal: controller.signal,
        });
        if (cancelled) return;
        nextTimelinePollMsRef.current = primary.nextPollMs ?? DEFAULT_TIMELINE_POLL_MS;
        applyTimelinePayload(primary, "replace");
        await appendTimelineFallback(primary, controller.signal);
      } catch (error: unknown) {
        if (
          (error as { name?: string }).name !== "AbortError" &&
          process.env.NODE_ENV !== "production"
        ) {
          console.warn("[claw42] public timeline fetch failed", error);
        }
      } finally {
        if (!cancelled) {
          pollTimer = window.setTimeout(() => void loadTimeline(), currentTimelinePollMs());
        }
      }
    }

    async function applyStreamPayload(payload: PublicTimelinePayload) {
      nextTimelinePollMsRef.current = payload.nextPollMs ?? DEFAULT_TIMELINE_POLL_MS;
      applyTimelinePayload(payload, "replace");
      controller?.abort();
      controller = new AbortController();
      await appendTimelineFallback(payload, controller.signal);
    }

    function startPolling(delay = 0) {
      if (pollTimer) window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(() => void loadTimeline(), delay);
    }

    function startStream() {
      if (document.visibilityState === "hidden" || typeof window.EventSource === "undefined") {
        startPolling(0);
        return;
      }

      if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
      closeEventSource();
      const params = new URLSearchParams({
        windowMinutes: String(PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES),
        limit: "100",
        locale: agentWatchLocale,
      });
      eventSource = new EventSource(apiPath(`/api/watch/stream?${params}`));
      eventSource.addEventListener("timeline", (message) => {
        try {
          void applyStreamPayload(JSON.parse(message.data) as PublicTimelinePayload).catch(
            (error: unknown) => {
              if (
                (error as { name?: string }).name !== "AbortError" &&
                process.env.NODE_ENV !== "production"
              ) {
                console.warn("[claw42] public timeline stream apply failed", error);
              }
            },
          );
        } catch (error: unknown) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[claw42] public timeline stream payload failed", error);
          }
        }
      });
      eventSource.onerror = () => {
        closeEventSource();
        startPolling(0);
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          if (!cancelled) startStream();
        }, TIMELINE_STREAM_RETRY_MS);
      };
    }

    function restartTimelineTransport() {
      controller?.abort();
      clearTimers();
      closeEventSource();
      if (document.visibilityState === "hidden") {
        startPolling(currentTimelinePollMs());
      } else {
        startStream();
      }
    }

    startStream();
    document.addEventListener("visibilitychange", restartTimelineTransport);

    return () => {
      cancelled = true;
      controller?.abort();
      clearTimers();
      closeEventSource();
      document.removeEventListener("visibilitychange", restartTimelineTransport);
    };
  }, [agentWatchLocale, applyTimelinePayload, fetchTimelineWindow]);

  const recordIds = useMemo(
    () =>
      Array.from(
        new Set(
          timelineEvents.flatMap((event) =>
            event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
          ),
        ),
      ),
    [timelineEvents],
  );
  const recordIdsKey = recordIds.join(",");

  const fetchFollowStats = useCallback(
    async (signal?: AbortSignal) => {
      if (!recordIdsKey) return;
      const params = new URLSearchParams({ recordIds: recordIdsKey });
      const response = await fetch(apiPath(`/api/watch/follow-stats?${params}`), {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) throw new Error(`watch follow stats ${response.status}`);
      const payload = (await response.json()) as FollowStatsPayload;
      setFollowStatsByRecordId((current) => ({ ...current, ...payload.stats }));
    },
    [recordIdsKey],
  );

  useEffect(() => {
    if (!recordIdsKey) return;
    let cancelled = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    function currentPollMs() {
      if (document.visibilityState === "hidden") return FOLLOW_STATS_HIDDEN_POLL_MS;
      return activeDispatchView === "mkt"
        ? FOLLOW_STATS_MARKET_POLL_MS
        : FOLLOW_STATS_VISIBLE_POLL_MS;
    }

    async function poll() {
      controller?.abort();
      controller = new AbortController();

      try {
        if (document.visibilityState !== "hidden") {
          await fetchFollowStats(controller.signal);
        }
      } catch (error: unknown) {
        if (
          (error as { name?: string }).name !== "AbortError" &&
          process.env.NODE_ENV !== "production"
        ) {
          console.warn("[claw42] follow stats fetch failed", error);
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, currentPollMs());
      }
    }

    function handleVisibilityChange() {
      if (timer) window.clearTimeout(timer);
      void poll();
    }

    void poll();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeDispatchView, fetchFollowStats, recordIdsKey]);

  useEffect(() => {
    if (!recordIdsKey) return;
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(FOLLOW_STATS_BROADCAST) : null;

    function refresh() {
      void fetchFollowStats();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === FOLLOW_STATS_STORAGE_EVENT) refresh();
    }

    channel?.addEventListener("message", refresh);
    window.addEventListener("storage", handleStorage);

    return () => {
      channel?.removeEventListener("message", refresh);
      channel?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchFollowStats, recordIdsKey]);

  const topics = useMemo(
    () =>
      mapPublicTimelineEventsToTopics({
        events: timelineEvents,
        evidenceMap: timelineEvidenceMap,
        followStatsByRecordId,
        locale: agentWatchLocale,
        outcomeDict,
        roundDict,
        stageStatusDict,
        topicRankingDict,
      }),
    [
      agentWatchLocale,
      followStatsByRecordId,
      outcomeDict,
      roundDict,
      stageStatusDict,
      topicRankingDict,
      timelineEvents,
      timelineEvidenceMap,
    ],
  );

  const broadcastFollowUpdate = useCallback((recordId: string) => {
    const payload = { recordId, ts: Date.now() };
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(FOLLOW_STATS_BROADCAST);
      channel.postMessage(payload);
      channel.close();
    }
    try {
      window.localStorage.setItem(FOLLOW_STATS_STORAGE_EVENT, JSON.stringify(payload));
    } catch {
      // Local storage can be unavailable in private browsing; BroadcastChannel is enough.
    }
  }, []);

  const handleTopicAction = useCallback(
    async (topic: DispatchTopic, _actionLabel: string, action: DispatchTopicAction) => {
      if (action !== "primary" || topic.strategy.follow.primaryDisabled) return;
      const recordId = topic.id;
      const previousStats = followStatsByRecordId[recordId];

      setFollowStatsByRecordId((current) => {
        const previous = current[recordId];
        return {
          ...current,
          [recordId]: {
            watchCount: previous?.watchCount ?? topic.strategy.follow.watchCount,
            followCount: previous?.userFollowed
              ? (previous.followCount ?? topic.strategy.follow.followCount)
              : (previous?.followCount ?? topic.strategy.follow.followCount) + 1,
            userFollowed: true,
          },
        };
      });

      try {
        const response = await fetch(apiPath("/api/watch/follow-stats"), {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "follow", recordId }),
        });
        if (!response.ok) throw new Error(`follow stats ${response.status}`);
        const payload = (await response.json()) as { stats: FollowStatsSnapshot };
        setFollowStatsByRecordId((current) => ({ ...current, [recordId]: payload.stats }));
        broadcastFollowUpdate(recordId);
      } catch (error: unknown) {
        setFollowStatsByRecordId((current) => {
          const next = { ...current };
          if (previousStats) next[recordId] = previousStats;
          else delete next[recordId];
          return next;
        });
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] follow stats update failed", error);
        }
      }
    },
    [broadcastFollowUpdate, followStatsByRecordId],
  );

  return (
    <Console
      topics={topics}
      initialView={initialView}
      onViewChange={setActiveDispatchView}
      onTopicAction={handleTopicAction}
      marketSnapshot={null}
    />
  );
}
