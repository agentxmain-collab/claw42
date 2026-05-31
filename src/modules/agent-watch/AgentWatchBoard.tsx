"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { apiPath } from "@/lib/basePath";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type {
  PublicTimelineSnapshotStatus,
  PublicTimelineSourceHealth,
} from "@/lib/watch/publicTimelinePayload";
import {
  comparePublicTimelineEvents,
  mergePublicTimelineEvents,
} from "@/lib/watch/publicTimelineOrdering";
import type { ResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";
import {
  mapPublicTimelineEventsToTopics,
  type FollowStatsSnapshot,
} from "@/lib/watch/v9TopicAdapter";
import { normalizeCandidateType } from "@/lib/watch/decisionCandidate";
import {
  hasPublicBetaSymbolCoverage,
  publicBetaSymbolCoverage,
  publicBetaSymbolCoverageKey,
} from "@/lib/watch/publicSymbolCoverage";
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

const PUBLIC_TIMELINE_MAX_PAGE = 2;
const PUBLIC_TIMELINE_STALE_AFTER_MS = 75 * 60_000;
const DEFAULT_TIMELINE_POLL_MS = 90_000;
const TIMELINE_HIDDEN_POLL_MS = 5 * 60_000;
const FOLLOW_STATS_BROADCAST = "claw42-follow-stats";
const FOLLOW_STATS_STORAGE_EVENT = "claw42-follow-stats-updated";
const DECISION_HISTORY_MAX_PAGE = 2;
const VISIBLE_SESSION_NO_SIGNAL_RETRY_MS = 5 * 60_000;
const VISIBLE_SESSION_REFRESH_STARTED_RETRY_MS = 90_000;
const AUTO_SYMBOL_REFRESH_CANDIDATE = "symbol";
const AUTO_SYMBOL_REFRESH_SYMBOL = "SYMBOL";
const HISTORY_WALL_ENABLED = process.env.NEXT_PUBLIC_HISTORY_WALL_ENABLED === "true";

interface PublicTimelinePayload {
  version?: string;
  generatedAt?: string;
  expiresAt?: string;
  events: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
  oldestTs: number | null;
  hasMore: boolean;
  windowMinutes: number;
  servedAt: number;
  nextPollMs?: number;
  residentStatus?: ResidentPrewarmStatus;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  followStats?: Record<string, FollowStatsSnapshot>;
  snapshotStatus?: PublicTimelineSnapshotStatus;
  sourceHealth?: PublicTimelineSourceHealth;
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

function isSnapshotPayloadStale(payload: Pick<PublicTimelinePayload, "generatedAt" | "expiresAt">) {
  const expiresAt = payload.expiresAt ? Date.parse(payload.expiresAt) : Number.NaN;
  if (Number.isFinite(expiresAt)) return Date.now() > expiresAt;
  const generatedAt = payload.generatedAt ? Date.parse(payload.generatedAt) : Number.NaN;
  return Number.isFinite(generatedAt)
    ? Date.now() - generatedAt > PUBLIC_TIMELINE_STALE_AFTER_MS
    : false;
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

export function sortTopicsForDisplay(topics: DispatchTopic[]) {
  return [...topics].sort((a, b) => {
    const rankDelta =
      (a.topicRanking?.rank ?? Number.POSITIVE_INFINITY) -
      (b.topicRanking?.rank ?? Number.POSITIVE_INFINITY);
    if (rankDelta !== 0) return rankDelta;
    const timeDelta = (b.lastUpdatedAt ?? 0) - (a.lastUpdatedAt ?? 0);
    if (timeDelta !== 0) return timeDelta;
    return a.id.localeCompare(b.id);
  });
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
  if (mode === "replace" && current.length > 0 && next.length === 0) return current;
  const merged =
    mode === "replace" && current.length === 0
      ? mergeTimelineEvents([], next)
      : mergeTimelineEvents(current, next);
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
    residentStatus: primary.residentStatus ?? fallback.residentStatus,
  };
}

export function resolveVisibleSessionRefreshTarget({
  topics,
  residentStatus,
  timelineLoaded,
  locale,
}: {
  topics: Pick<DispatchTopic, "candidateType" | "symbol">[];
  residentStatus?: ResidentPrewarmStatus | null;
  timelineLoaded: boolean;
  locale: string;
}): VisibleSessionRefreshTarget | null {
  if (!timelineLoaded) return null;
  void residentStatus;

  const symbolCoverage = publicBetaSymbolCoverage(
    topics
      .filter((topic) => normalizeCandidateType(topic.candidateType) === "symbol")
      .map((topic) => topic.symbol),
  );
  if (!hasPublicBetaSymbolCoverage(symbolCoverage)) {
    return {
      sessionKey: `freshness-trigger-${locale}-${AUTO_SYMBOL_REFRESH_CANDIDATE}-auto-${publicBetaSymbolCoverageKey(symbolCoverage)}`,
      symbol: AUTO_SYMBOL_REFRESH_SYMBOL,
      params: { candidateType: AUTO_SYMBOL_REFRESH_CANDIDATE },
    };
  }

  const latestRefreshSymbol = symbolCoverage[0];
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryWallItem[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<DispatchFreshnessState>({ status: "idle" });
  const [residentStatus, setResidentStatus] = useState<ResidentPrewarmStatus | null>(null);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [timelineTotalCount, setTimelineTotalCount] = useState(0);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
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
      if (payload.followStats) {
        setFollowStatsByRecordId((current) => {
          const next = { ...current };
          for (const [recordId, stats] of Object.entries(payload.followStats ?? {})) {
            next[recordId] = {
              watchCount: stats.watchCount,
              followCount: stats.followCount,
              userFollowed: current[recordId]?.userFollowed ?? Boolean(stats.userFollowed),
            };
          }
          return next;
        });
      }
      if (payload.residentStatus) setResidentStatus(payload.residentStatus);
      if (payload.snapshotStatus || payload.generatedAt) {
        const rawSnapshotStatus = payload.snapshotStatus ?? "stale";
        const snapshotStatus =
          rawSnapshotStatus === "fresh" && isSnapshotPayloadStale(payload)
            ? "stale"
            : rawSnapshotStatus;
        setFreshness({
          status:
            snapshotStatus === "fresh"
              ? "cached"
              : snapshotStatus === "empty"
                ? "no_signal"
                : "stale",
          lastDecisionAt: payload.generatedAt ?? null,
          refreshSource: "timeline",
          snapshotStatus,
          snapshotGeneratedAt: payload.generatedAt,
          snapshotSourceHealth: payload.sourceHealth,
        });
      }
      if (typeof payload.page === "number") {
        setTimelinePage((current) =>
          mode === "replace" && payload.page === 1 ? 1 : Math.max(current, payload.page ?? 1),
        );
      }
      if (typeof payload.totalCount === "number") setTimelineTotalCount(payload.totalCount);
      setTimelineHasMore(payload.hasMore && (payload.page ?? 1) < PUBLIC_TIMELINE_MAX_PAGE);
    },
    [],
  );

  const fetchTimelineWindow = useCallback(
    async ({ page = 1, signal }: { page?: number; signal?: AbortSignal }) => {
      const canonicalPage = Math.min(Math.max(Math.floor(page), 1), PUBLIC_TIMELINE_MAX_PAGE);
      const params = new URLSearchParams({
        locale: agentWatchLocale,
        page: String(canonicalPage),
      });
      const response = await fetch(apiPath(`/api/watch/timeline?${params}`), {
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
    let controller: AbortController | null = null;

    function clearTimers() {
      if (pollTimer) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    }

    function currentTimelinePollMs() {
      return document.visibilityState === "hidden"
        ? TIMELINE_HIDDEN_POLL_MS
        : nextTimelinePollMsRef.current;
    }

    async function loadTimeline() {
      controller?.abort();
      controller = new AbortController();

      try {
        const primary = await fetchTimelineWindow({
          page: 1,
          signal: controller.signal,
        });
        if (cancelled) return;
        nextTimelinePollMsRef.current = primary.nextPollMs ?? DEFAULT_TIMELINE_POLL_MS;
        applyTimelinePayload(primary, "replace");
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

    function startPolling(delay = 0) {
      if (pollTimer) window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(() => void loadTimeline(), delay);
    }

    function restartTimelineTransport() {
      controller?.abort();
      clearTimers();
      if (document.visibilityState === "hidden") {
        startPolling(currentTimelinePollMs());
      } else {
        startPolling(0);
      }
    }

    startPolling(0);
    document.addEventListener("visibilitychange", restartTimelineTransport);

    return () => {
      cancelled = true;
      controller?.abort();
      clearTimers();
      document.removeEventListener("visibilitychange", restartTimelineTransport);
    };
  }, [agentWatchLocale, applyTimelinePayload, fetchTimelineWindow]);

  const handleLoadMoreTimeline = useCallback(() => {
    if (!timelineHasMore || timelineLoadingMore) return;
    setTimelineLoadingMore(true);
    const nextPage = timelinePage + 1;
    if (nextPage > PUBLIC_TIMELINE_MAX_PAGE) {
      setTimelineHasMore(false);
      setTimelineLoadingMore(false);
      return;
    }
    void fetchTimelineWindow({
      page: nextPage,
    })
      .then((payload) => {
        nextTimelinePollMsRef.current = payload.nextPollMs ?? DEFAULT_TIMELINE_POLL_MS;
        applyTimelinePayload(payload, "append");
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] public timeline page fetch failed", error);
        }
      })
      .finally(() => {
        setTimelineLoadingMore(false);
      });
  }, [
    applyTimelinePayload,
    fetchTimelineWindow,
    timelineHasMore,
    timelineLoadingMore,
    timelinePage,
  ]);

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
    async ({ signal, userScoped = false }: { signal?: AbortSignal; userScoped?: boolean } = {}) => {
      if (!recordIdsKey) return;
      const params = new URLSearchParams({ recordIds: recordIdsKey });
      if (userScoped) params.set("user", "1");
      const response = await fetch(apiPath(`/api/watch/follow-stats?${params}`), {
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
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(FOLLOW_STATS_BROADCAST) : null;

    function refresh() {
      void fetchFollowStats({ userScoped: true });
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

  const topics = useMemo(() => {
    const mappedTopics = mapPublicTimelineEventsToTopics({
      events: timelineEvents,
      evidenceMap: timelineEvidenceMap,
      followStatsByRecordId,
      locale: agentWatchLocale,
      outcomeDict,
      roundDict,
      stageStatusDict,
      topicRankingDict,
    });
    return sortTopicsForDisplay(mappedTopics);
  }, [
    agentWatchLocale,
    followStatsByRecordId,
    outcomeDict,
    roundDict,
    stageStatusDict,
    topicRankingDict,
    timelineEvents,
    timelineEvidenceMap,
  ]);
  const consoleFreshness = useMemo<DispatchFreshnessState>(
    () => ({
      ...freshness,
      ...(residentStatus ? { residentStatus } : {}),
    }),
    [freshness, residentStatus],
  );

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
      page = 1,
      mode,
      signal,
    }: {
      symbol: string;
      page?: number;
      mode: "replace" | "append";
      signal?: AbortSignal;
    }) => {
      const params = new URLSearchParams({
        symbol,
        locale: agentWatchLocale,
        page: String(Math.min(Math.max(Math.floor(page), 1), DECISION_HISTORY_MAX_PAGE)),
      });

      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(apiPath(`/api/watch/decision-history?${params}`), {
          signal,
        });
        if (!response.ok) throw new Error(`decision history ${response.status}`);
        const payload = (await response.json()) as DecisionHistoryPayload;
        setHistoryItems((current) =>
          mode === "replace" ? payload.items : [...current, ...payload.items],
        );
        setHistoryPage(page);
        setHistoryHasMore(payload.hasMore && page < DECISION_HISTORY_MAX_PAGE);
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
    setHistoryPage(1);
  }, []);

  const handleMoreHistory = useCallback(() => {
    if (!historySymbol || !historyHasMore || historyLoading) return;
    const nextPage = historyPage + 1;
    if (nextPage > DECISION_HISTORY_MAX_PAGE) {
      setHistoryHasMore(false);
      return;
    }
    void fetchDecisionHistory({
      symbol: historySymbol,
      page: nextPage,
      mode: "append",
    });
  }, [fetchDecisionHistory, historyHasMore, historyLoading, historyPage, historySymbol]);

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
        onTopicAction={handleTopicAction}
        marketSnapshot={null}
        followTradeDict={followTradeDict}
        freshness={consoleFreshness}
        pagination={{
          hasMore: timelineHasMore,
          loading: timelineLoadingMore,
          loadedCount: timelineTotalCount || topics.length,
          onLoadMore: handleLoadMoreTimeline,
        }}
      />
      {HISTORY_WALL_ENABLED ? (
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
      ) : null}
    </>
  );
}
