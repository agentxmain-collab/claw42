"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { apiPath } from "@/lib/basePath";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  comparePublicTimelineEvents,
  mergePublicTimelineEvents,
} from "@/lib/watch/publicTimelineOrdering";
import {
  mapPublicTimelineEventsToTopics,
  type FollowStatsSnapshot,
} from "@/lib/watch/v9TopicAdapter";
import { normalizeCandidateType } from "@/lib/watch/decisionCandidate";
import { useI18n } from "@/i18n/I18nProvider";
import type { DecisionHistoryPayload } from "@/lib/watch/decisionHistory";
import { DispatchConsoleV9 } from "./v9/DispatchConsoleV9";
import { HistoryWall, type HistoryWallItem } from "./v9/HistoryWall";
import type {
  DispatchFreshnessState,
  DispatchConsoleV9Props,
  DispatchTopic,
  DispatchTopicAction,
  DispatchView,
} from "./v9/types";
import { resolveAgentWatchLocale } from "./locale";
import { fallbackBeforeForPublicTimeline } from "./utils/publicTimelineWindow";

const PUBLIC_TIMELINE_MIN_ENTRIES = 30;
const PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES = 60;
const PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES = 24 * 60;
const DEFAULT_TIMELINE_POLL_MS = 90_000;
const TIMELINE_STREAM_RETRY_MS = 30_000;
const TIMELINE_HIDDEN_POLL_MS = 5 * 60_000;
const FOLLOW_STATS_VISIBLE_POLL_MS = 60_000;
const FOLLOW_STATS_MARKET_POLL_MS = 30_000;
const FOLLOW_STATS_HIDDEN_POLL_MS = 5 * 60_000;
const FOLLOW_STATS_BROADCAST = "claw42-follow-stats";
const FOLLOW_STATS_STORAGE_EVENT = "claw42-follow-stats-updated";
const DECISION_HISTORY_LIMIT = 20;
const VISIBLE_SESSION_NO_SIGNAL_RETRY_MS = 5 * 60_000;
const VISIBLE_SESSION_REFRESH_STARTED_RETRY_MS = 90_000;
const VISIBLE_SESSION_MAX_RETRY_MS = 5 * 60_000;
const EMPTY_STATE_REFRESH_CANDIDATE = "market_overview";
const EMPTY_STATE_REFRESH_SYMBOL = "MARKET";
const HOTSPOT_REFRESH_CANDIDATE = "hotspot";
const HOTSPOT_REFRESH_SYMBOL = "HOTSPOT";
const AUTO_SYMBOL_REFRESH_CANDIDATE = "symbol";
const AUTO_SYMBOL_REFRESH_SYMBOL = "SYMBOL";

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

interface WatchRefreshPayload {
  status: Exclude<DispatchFreshnessState["status"], "idle" | "error">;
  symbol: string;
  lastDecisionAt: string | null;
  nextAllowedAt: string | null;
  refreshStarted: boolean;
  refreshSource: DispatchFreshnessState["refreshSource"];
}

type VisibleSessionRefreshStatus = WatchRefreshPayload["status"];
type VisibleSessionRefreshResult =
  | VisibleSessionRefreshStatus
  | Pick<WatchRefreshPayload, "status" | "refreshStarted">;

function visibleSessionRefreshStatus(result: VisibleSessionRefreshResult) {
  return typeof result === "string" ? result : result.status;
}

function visibleSessionRefreshStarted(result: VisibleSessionRefreshResult) {
  return typeof result === "string" ? false : result.refreshStarted;
}

export function shouldPersistVisibleSessionRefreshResult(result: VisibleSessionRefreshResult) {
  const status = visibleSessionRefreshStatus(result);
  if (visibleSessionRefreshStarted(result)) return false;
  return status === "cached" || status === "stale";
}

export function retryDelayForVisibleSessionRefresh(
  payload: Pick<WatchRefreshPayload, "status" | "nextAllowedAt"> &
    Partial<Pick<WatchRefreshPayload, "refreshStarted">>,
  now = Date.now(),
) {
  if (payload.status === "locked" || payload.status === "refreshing") {
    const retryAt = payload.nextAllowedAt ? Date.parse(payload.nextAllowedAt) : Number.NaN;
    return Number.isFinite(retryAt) ? Math.max(30_000, retryAt - now + 1000) : 60_000;
  }

  if (payload.refreshStarted) return VISIBLE_SESSION_REFRESH_STARTED_RETRY_MS;
  if (payload.status === "no_signal") return VISIBLE_SESSION_NO_SIGNAL_RETRY_MS;
  return null;
}

interface VisibleSessionRefreshTarget {
  sessionKey: string;
  symbol: string;
  params: Record<string, string>;
}

function mergeTimelineEvents(current: PublicTimelineEvent[], next: PublicTimelineEvent[]) {
  return mergePublicTimelineEvents([...current, ...next]);
}

export function reconcileTimelineEventsForDisplay({
  current,
  next,
  mode,
}: {
  current: PublicTimelineEvent[];
  next: PublicTimelineEvent[];
  mode: "replace" | "append";
}) {
  const merged =
    mode === "replace" ? mergeTimelineEvents([], next) : mergeTimelineEvents(current, next);
  if (mode === "replace" && current.length > 0 && merged.length === 0) return current;
  return merged;
}

export function mergeTimelinePayloadForDisplay(
  primary: PublicTimelinePayload,
  fallback: PublicTimelinePayload,
): PublicTimelinePayload {
  const events = mergeTimelineEvents(primary.events, fallback.events);

  return {
    ...primary,
    events,
    evidenceMap: {
      ...(fallback.evidenceMap ?? {}),
      ...(primary.evidenceMap ?? {}),
    },
    oldestTs:
      events.length > 0 ? (events[events.length - 1]?.ts ?? fallback.oldestTs) : fallback.oldestTs,
    hasMore: primary.hasMore || fallback.hasMore,
    windowMinutes: Math.max(primary.windowMinutes, fallback.windowMinutes),
  };
}

export function resolveVisibleSessionRefreshTarget({
  topics,
  timelineLoaded,
  locale,
}: {
  topics: Pick<DispatchTopic, "candidateType" | "symbol">[];
  timelineLoaded: boolean;
  locale: string;
}): VisibleSessionRefreshTarget | null {
  if (!timelineLoaded) return null;

  const hasMarketOverviewTopic = topics.some(
    (topic) => normalizeCandidateType(topic.candidateType) === "market_overview",
  );
  if (!hasMarketOverviewTopic) {
    return {
      sessionKey: `freshness-trigger-${locale}-${EMPTY_STATE_REFRESH_CANDIDATE}`,
      symbol: EMPTY_STATE_REFRESH_SYMBOL,
      params: { candidateType: EMPTY_STATE_REFRESH_CANDIDATE },
    };
  }

  const hasHotspotTopic = topics.some(
    (topic) => normalizeCandidateType(topic.candidateType) === "hotspot",
  );
  if (!hasHotspotTopic) {
    return {
      sessionKey: `freshness-trigger-${locale}-${HOTSPOT_REFRESH_CANDIDATE}`,
      symbol: HOTSPOT_REFRESH_SYMBOL,
      params: { candidateType: HOTSPOT_REFRESH_CANDIDATE },
    };
  }

  const latestRefreshSymbol =
    topics.find((topic) => normalizeCandidateType(topic.candidateType) === "symbol")?.symbol ??
    null;
  if (!latestRefreshSymbol) {
    return {
      sessionKey: `freshness-trigger-${locale}-${AUTO_SYMBOL_REFRESH_CANDIDATE}-auto`,
      symbol: AUTO_SYMBOL_REFRESH_SYMBOL,
      params: { candidateType: AUTO_SYMBOL_REFRESH_CANDIDATE },
    };
  }

  return {
    sessionKey: `freshness-trigger-${locale}-symbol-${latestRefreshSymbol}`,
    symbol: latestRefreshSymbol,
    params: { symbol: latestRefreshSymbol },
  };
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
  const historyDict = t.agentWatch.dispatchV10.history;
  const followTradeDict = t.agentWatch.dispatchV10.followTrade;
  const [timelineEvents, setTimelineEvents] = useState<PublicTimelineEvent[]>([]);
  const [timelineEvidenceMap, setTimelineEvidenceMap] = useState<Record<string, NewsEvidence>>({});
  const [followStatsByRecordId, setFollowStatsByRecordId] = useState<
    Record<string, FollowStatsSnapshot>
  >({});
  const [activeDispatchView, setActiveDispatchView] = useState<DispatchView>(initialView);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryWallItem[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyNextBefore, setHistoryNextBefore] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<DispatchFreshnessState>({ status: "idle" });
  const [timelineLoaded, setTimelineLoaded] = useState(false);
  const nextTimelinePollMsRef = useRef(DEFAULT_TIMELINE_POLL_MS);

  const applyTimelinePayload = useCallback(
    (payload: PublicTimelinePayload, mode: "replace" | "append") => {
      const sorted = payload.events.slice().sort(comparePublicTimelineEvents);
      setTimelineEvents((current) =>
        reconcileTimelineEventsForDisplay({
          current,
          next: sorted,
          mode,
        }),
      );
      if (payload.evidenceMap) {
        setTimelineEvidenceMap((current) =>
          mode === "replace" && sorted.length === 0
            ? current
            : mode === "replace"
              ? (payload.evidenceMap ?? {})
              : { ...current, ...payload.evidenceMap },
        );
      }
      setTimelineLoaded(true);
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

    async function payloadWithTimelineFallback(
      primary: PublicTimelinePayload,
      signal: AbortSignal,
    ) {
      if (primary.events.length >= PUBLIC_TIMELINE_MIN_ENTRIES) return primary;
      const fallback = await fetchTimelineWindow({
        windowMinutes: PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES,
        before: fallbackBeforeForPublicTimeline(primary),
        limit: 100,
        signal,
      });
      return mergeTimelinePayloadForDisplay(primary, fallback);
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
        const displayPayload = await payloadWithTimelineFallback(primary, controller.signal);
        if (cancelled) return;
        applyTimelinePayload(displayPayload, "replace");
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
      controller?.abort();
      controller = new AbortController();
      const displayPayload = await payloadWithTimelineFallback(payload, controller.signal);
      if (!cancelled) applyTimelinePayload(displayPayload, "replace");
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
  useEffect(() => {
    const refreshTarget = resolveVisibleSessionRefreshTarget({
      topics,
      timelineLoaded,
      locale: agentWatchLocale,
    });
    if (!refreshTarget) return;
    const target = refreshTarget;
    let cancelled = false;
    let controller: AbortController | null = null;
    let retryTimer: number | null = null;

    async function triggerRefresh() {
      if (document.visibilityState !== "visible") return;
      try {
        if (window.sessionStorage.getItem(target.sessionKey)) return;
      } catch {
        // Session storage can be blocked; still allow a single visible effect run.
      }

      controller?.abort();
      controller = new AbortController();
      const params = new URLSearchParams({
        locale: agentWatchLocale,
      });
      for (const [key, value] of Object.entries(target.params)) {
        params.set(key, value);
      }

      try {
        const response = await fetch(apiPath(`/api/watch/refresh?${params}`), {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok && response.status !== 429) {
          throw new Error(`watch refresh ${response.status}`);
        }
        const payload = (await response.json()) as WatchRefreshPayload;
        if (!cancelled) {
          setFreshness({
            status: payload.status,
            symbol: payload.symbol || target.symbol,
            lastDecisionAt: payload.lastDecisionAt,
            nextAllowedAt: payload.nextAllowedAt,
            refreshStarted: payload.refreshStarted,
            refreshSource: payload.refreshSource,
          });
          const retryDelay = retryDelayForVisibleSessionRefresh(payload);
          if (retryDelay !== null) {
            if (retryTimer !== null) window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(
              () => {
                void triggerRefresh();
              },
              Math.min(retryDelay, VISIBLE_SESSION_MAX_RETRY_MS),
            );
          }

          if (shouldPersistVisibleSessionRefreshResult(payload)) {
            try {
              window.sessionStorage.setItem(target.sessionKey, String(Date.now()));
            } catch {
              // Session storage can be blocked; the request has already completed.
            }
          }
        }
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return;
        if (!cancelled) setFreshness({ status: "error", symbol: target.symbol });
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] watch freshness trigger failed", error);
        }
      }
    }

    function handleVisibilityChange() {
      void triggerRefresh();
    }

    void triggerRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      controller?.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [agentWatchLocale, timelineLoaded, topics]);

  const historySymbols = useMemo(
    () => Array.from(new Set(topics.map((topic) => topic.symbol).filter(Boolean))),
    [topics],
  );

  useEffect(() => {
    if (!historyOpen) return;
    setHistorySymbol((current) =>
      current && historySymbols.includes(current) ? current : (historySymbols[0] ?? null),
    );
  }, [historyOpen, historySymbols]);

  const fetchDecisionHistory = useCallback(
    async ({
      symbol,
      before,
      mode,
      signal,
    }: {
      symbol: string;
      before?: string | null;
      mode: "replace" | "append";
      signal?: AbortSignal;
    }) => {
      const params = new URLSearchParams({
        symbol,
        locale: agentWatchLocale,
        limit: String(DECISION_HISTORY_LIMIT),
      });
      if (before) params.set("before", before);

      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(apiPath(`/api/watch/decision-history?${params}`), {
          cache: "no-store",
          signal,
        });
        if (!response.ok) throw new Error(`decision history ${response.status}`);
        const payload = (await response.json()) as DecisionHistoryPayload;
        setHistoryItems((current) =>
          mode === "replace" ? payload.items : [...current, ...payload.items],
        );
        setHistoryHasMore(payload.hasMore);
        setHistoryNextBefore(payload.nextBefore);
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return;
        setHistoryError(historyDict.error);
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] decision history fetch failed", error);
        }
      } finally {
        if (!signal?.aborted) setHistoryLoading(false);
      }
    },
    [agentWatchLocale, historyDict.error],
  );

  useEffect(() => {
    if (!historyOpen || !historySymbol) return;
    const controller = new AbortController();
    void fetchDecisionHistory({
      symbol: historySymbol,
      mode: "replace",
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [fetchDecisionHistory, historyOpen, historySymbol]);

  const handleSelectHistorySymbol = useCallback((symbol: string) => {
    setHistorySymbol(symbol);
    setHistoryItems([]);
    setHistoryHasMore(false);
    setHistoryNextBefore(null);
  }, []);

  const handleMoreHistory = useCallback(() => {
    if (!historySymbol || !historyHasMore || historyLoading) return;
    void fetchDecisionHistory({
      symbol: historySymbol,
      before: historyNextBefore,
      mode: "append",
    });
  }, [fetchDecisionHistory, historyHasMore, historyLoading, historyNextBefore, historySymbol]);

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
      if (
        action !== "primary" ||
        (topic.candidateType ?? "symbol") !== "symbol" ||
        topic.strategy.follow.primaryDisabled ||
        topic.execution?.executable !== true
      ) {
        return;
      }
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
    <>
      <Console
        topics={topics}
        initialView={initialView}
        onViewChange={setActiveDispatchView}
        onTopicAction={handleTopicAction}
        marketSnapshot={null}
        followTradeDict={followTradeDict}
        freshness={freshness}
      />
      <HistoryWall
        open={historyOpen}
        symbols={historySymbols}
        selectedSymbol={historySymbol}
        locale={agentWatchLocale}
        dict={historyDict}
        items={historyItems}
        hasMore={historyHasMore}
        loading={historyLoading}
        error={historyError}
        onOpen={() => setHistoryOpen(true)}
        onClose={() => setHistoryOpen(false)}
        onMore={handleMoreHistory}
        onSelectSymbol={handleSelectHistorySymbol}
      />
    </>
  );
}
