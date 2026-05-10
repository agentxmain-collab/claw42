"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { buildChatterPlan } from "@/lib/chatterGenerator";
import type { ChatThread } from "@/lib/types";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { DecisionTimeline } from "@/components/agent-watch/DecisionTimeline";
import { AGENT_ORDER } from "./agents";
import { useAgentAnalysis, useMarketTicker } from "./hooks/useAgentAnalysis";
import { useAgentHistory } from "./hooks/useAgentHistory";
import { useMarketEventFeed } from "./hooks/useMarketEventFeed";
import type {
  AgentDiscussionEntry,
  AgentMessage,
  AgentId,
  ChatThreadEntry,
  NewsDebateEntry,
  StreamEntry,
  WatchUpdateEntry,
} from "./types";
import { CoinTickerStrip } from "./components/CoinTickerStrip";
import { MarketEventFeed } from "./components/MarketEventFeed";
import { CriticalNewsBanner } from "./components/CriticalNewsBanner";
import { NewsFeedTicker } from "./components/NewsFeedTicker";
import { NewContentBanner } from "./components/NewContentBanner";
import { TopicHeader } from "./components/TopicHeader";
import {
  displayScheduleStartDelay,
  gapDurationAfterStreamEntry,
  speakerForStreamEntry,
  splitStreamEntryForDisplay,
  thinkDurationForStreamEntry,
} from "./utils/streamDisplayQueue";
import { filterStreamEntries } from "./utils/streamFilter";
import { buildWatchSupplementalEntry } from "./utils/watchSupplementalUpdates";
import { isAgentWatchLocale, resolveAgentWatchLocale } from "./locale";
import {
  buildWatchDirectorOpening,
  directorModeForVisit,
  readWatchDirectorMemory,
  rememberDirectorEntries,
  type WatchDirectorMemory,
  type WatchDirectorMode,
  writeWatchDirectorMemory,
} from "./utils/watchSessionDirector";

const DUPLICATE_CONTENT_WINDOW_MS = 5 * 60_000;
const STREAM_MAX_ENTRIES = 48;
const SHOW_TICKERS = process.env.NEXT_PUBLIC_WATCH_SHOW_TICKERS === "true";
const PUBLIC_TIMELINE_MIN_ENTRIES = 30;
const PUBLIC_TIMELINE_PRIMARY_WINDOW_MINUTES = 60;
const PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES = 720;

interface PublicTimelinePayload {
  events: PublicTimelineEvent[];
  oldestTs: number | null;
  hasMore: boolean;
  windowMinutes: number;
  servedAt: number;
  nextPollMs?: number;
}

function entriesFromInitialThreads(threads: ChatThread[]): ChatThreadEntry[] {
  return threads.map((thread) => ({
    kind: "chat_thread",
    id: `initial-${thread.id}`,
    ts: thread.messages[0]?.ts ?? thread.createdAt,
    thread,
  }));
}

function isAgentMessage(entry: StreamEntry): entry is AgentMessage {
  return entry.kind === "agent_message";
}

function isWatchUpdate(entry: StreamEntry): entry is WatchUpdateEntry {
  return entry.kind === "watch_update";
}

function isAgentDiscussion(entry: StreamEntry): entry is AgentDiscussionEntry {
  return entry.kind === "agent_discussion";
}

function speakerIdsForEntry(entry: StreamEntry): AgentId[] {
  if (isAgentMessage(entry)) return [entry.agentId];
  if (isWatchUpdate(entry)) return entry.agentId ? [entry.agentId] : [];
  if (isAgentDiscussion(entry)) return entry.responses.map((response) => response.agentId);
  if (entry.kind === "news_debate") {
    return entry.debate.messages.map((message) => message.agentId);
  }
  if (entry.kind === "chat_thread") {
    return entry.thread.messages.map((message) => message.agentId);
  }
  if (entry.kind === "focus_event") return [entry.primaryResponse.agentId];
  if (entry.kind === "collective_event") {
    return [entry.primaryResponse, ...entry.echoResponses].map((response) => response.agentId);
  }
  if (entry.kind === "conflict_event") return entry.responses.map((response) => response.agentId);
  return [];
}

function needsAgentDiversity(entries: StreamEntry[]) {
  const recentSpeakers = entries.slice(-4).flatMap(speakerIdsForEntry);
  if (recentSpeakers.length === 0) return false;
  return new Set(recentSpeakers).size < 2;
}

function warnDuplicateEntry(reason: string, entry: StreamEntry) {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[claw42] duplicate watch stream entry skipped", {
    reason,
    id: entry.id,
    kind: entry.kind,
    agentId: isAgentMessage(entry) ? entry.agentId : null,
    timestamp: entry.ts,
  });
}

function dedupeStreamEntries(entries: StreamEntry[]) {
  const seenIds = new Set<string>();
  const recentContent = new Map<string, number>();
  const unique: StreamEntry[] = [];

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      warnDuplicateEntry("id", entry);
      continue;
    }

    if (isAgentMessage(entry) || isWatchUpdate(entry) || isAgentDiscussion(entry)) {
      const contentKey = isAgentMessage(entry)
        ? `agent:${entry.agentId}:${entry.content.trim()}`
        : isWatchUpdate(entry)
          ? `watch:${entry.dedupeKey}:${entry.content.trim()}`
          : `discussion:${entry.dedupeKey}:${entry.responses.map((response) => response.content.trim()).join("|")}`;
      const lastTimestamp = recentContent.get(contentKey);
      if (
        lastTimestamp !== undefined &&
        Math.abs(entry.ts - lastTimestamp) <= DUPLICATE_CONTENT_WINDOW_MS
      ) {
        warnDuplicateEntry("content", entry);
        continue;
      }
      recentContent.set(contentKey, entry.ts);
    }

    seenIds.add(entry.id);
    unique.push(entry);
  }

  return unique;
}

function trimStreamEntries(entries: StreamEntry[]) {
  const keptAgentMessages = new Set<string>();
  for (const agentId of AGENT_ORDER) {
    entries
      .filter((entry): entry is AgentMessage => isAgentMessage(entry) && entry.agentId === agentId)
      .slice(-5)
      .forEach((entry) => keptAgentMessages.add(entry.id));
  }
  return entries
    .filter((entry) => !isAgentMessage(entry) || keptAgentMessages.has(entry.id))
    .slice(-STREAM_MAX_ENTRIES);
}

function streamEntriesFromPayload(data: NonNullable<ReturnType<typeof useAgentAnalysis>["data"]>) {
  const debateEntries: NewsDebateEntry[] =
    data.newsDebates?.map((debate) => ({
      kind: "news_debate",
      id: debate.id,
      ts: debate.ts,
      debate,
    })) ?? [];

  if (data.streamEntries?.length) {
    return dedupeStreamEntries([...debateEntries, ...data.streamEntries]).sort(
      (a, b) => a.ts - b.ts,
    );
  }

  const legacyEntries = data.stream.map(
    (item, index): AgentMessage => ({
      kind: "agent_message",
      id: `${data.generatedAt}-${item.agentId}-${index}`,
      ts: data.generatedAt,
      agentId: item.agentId,
      content: item.content,
      triggerSignalId: `legacy-${data.generatedAt}-${item.agentId}-${index}`,
    }),
  );

  return dedupeStreamEntries([...debateEntries, ...legacyEntries]).sort((a, b) => a.ts - b.ts);
}

export function AgentWatchBoard({
  initialChatThreads = [],
}: {
  initialChatThreads?: ChatThread[];
}) {
  const { t, locale } = useI18n();
  const agentWatchLocale = resolveAgentWatchLocale(locale);
  const isSupportedAgentWatchLocale = isAgentWatchLocale(locale);
  const reduceMotion = useReducedMotion();
  const { isLoading: isHistoryLoading, refreshHistory } = useAgentHistory({
    enabled: isSupportedAgentWatchLocale,
    initialLimit: 60,
  });
  const { data, isLoading, hasNewContent, dismissNewContent } = useAgentAnalysis({
    enabled: isSupportedAgentWatchLocale,
    locale: agentWatchLocale,
  });
  const { data: tickerData } = useMarketTicker({
    enabled: isSupportedAgentWatchLocale,
    intervalMs: 10_000,
  });
  const { signals: marketSignals } = useMarketEventFeed({
    enabled: isSupportedAgentWatchLocale,
    limit: 12,
  });
  const processedGeneratedAtRef = useRef<number | null>(null);
  const historySentinelRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const scheduledUntilRef = useRef(0);
  const marketSignalsRef = useRef(marketSignals);
  const directorMemoryRef = useRef<WatchDirectorMemory | null>(null);
  const directorModeRef = useRef<WatchDirectorMode | null>(null);
  const supplementalClaimRef = useRef(new Map<string, number>());
  const lastSupplementalAtRef = useRef(0);
  const hasScheduledInitialRef = useRef(false);
  const fiveSecondGuardRef = useRef(false);
  const [liveQueue, setLiveQueue] = useState<StreamEntry[]>(() => {
    const initialEntries = filterStreamEntries(entriesFromInitialThreads(initialChatThreads));
    return initialEntries;
  });
  const [, setHistoryEntries] = useState<StreamEntry[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<PublicTimelineEvent[]>([]);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [timelineOldestTs, setTimelineOldestTs] = useState<number | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [, setTypingAgent] = useState<AgentId | null>(null);
  const [, setSpeakingAgent] = useState<AgentId | null>(null);

  const applyHistoryPayload = useCallback(
    (
      data: { entries?: StreamEntry[]; hasMore?: boolean; oldestTs?: number | null },
      mode: "replace" | "prepend",
    ) => {
      const chronologicalEntries = filterStreamEntries(
        dedupeStreamEntries([...(data.entries ?? [])]),
      ).sort((a, b) => a.ts - b.ts);
      if (mode === "replace") {
        setHistoryEntries(chronologicalEntries);
        if (chronologicalEntries.length > 0) {
          setLiveQueue((current) => current.filter((entry) => !entry.id.startsWith("boot-")));
        }
      } else {
        setHistoryEntries((current) =>
          dedupeStreamEntries([...chronologicalEntries, ...current]).sort((a, b) => a.ts - b.ts),
        );
      }
    },
    [],
  );

  const applyTimelinePayload = useCallback(
    (payload: PublicTimelinePayload, mode: "replace" | "append") => {
      const sorted = payload.events.slice().sort((a, b) => b.ts - a.ts);
      setTimelineEvents((current) => {
        const merged = mode === "replace" ? sorted : [...current, ...sorted];
        const seen = new Set<string>();
        return merged
          .filter((event) => {
            if (seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
          })
          .sort((a, b) => b.ts - a.ts);
      });
      const oldestFromEvents =
        sorted.length > 0
          ? sorted.reduce((min, event) => Math.min(min, event.ts), sorted[0]!.ts)
          : null;
      setTimelineOldestTs(oldestFromEvents ?? payload.oldestTs ?? null);
      setTimelineHasMore(Boolean(payload.hasMore));
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
      });
      if (before) params.set("before", String(before));
      const response = await fetch(`/api/watch/timeline?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`watch timeline ${response.status}`);
      return (await response.json()) as PublicTimelinePayload;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watch/history?limit=30", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`watch history ${response.status}`);
        return response.json() as Promise<{
          entries: StreamEntry[];
          hasMore: boolean;
          oldestTs: number | null;
        }>;
      })
      .then((payload) => {
        if (!cancelled) applyHistoryPayload(payload, "replace");
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] watch history fetch failed", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyHistoryPayload]);

  useEffect(() => {
    let cancelled = false;
    setTimelineLoading(true);

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
          before: primary.oldestTs ?? Date.now(),
          limit: 100,
        });
        if (cancelled) return;
        applyTimelinePayload(fallback, "append");
      }
    }

    loadTimeline()
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[claw42] public timeline fetch failed", error);
        }
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyTimelinePayload, fetchTimelineWindow]);

  useEffect(() => {
    marketSignalsRef.current = marketSignals;
  }, [marketSignals]);

  const ensureDirectorMemory = useCallback((now: number) => {
    if (directorMemoryRef.current === null) {
      const storage = typeof window === "undefined" ? undefined : window.localStorage;
      const memory = readWatchDirectorMemory(storage);
      directorMemoryRef.current = memory;
      directorModeRef.current = directorModeForVisit(now, memory.lastVisitAt);
    }

    return {
      memory: directorMemoryRef.current,
      mode: directorModeRef.current ?? "fresh",
    };
  }, []);

  const rememberScheduledEntries = useCallback(
    (entries: StreamEntry[], now: number) => {
      const { memory } = ensureDirectorMemory(now);
      const nextMemory = rememberDirectorEntries(memory, entries, now);
      directorMemoryRef.current = nextMemory;
      const storage = typeof window === "undefined" ? undefined : window.localStorage;
      writeWatchDirectorMemory(storage, nextMemory);
    },
    [ensureDirectorMemory],
  );

  const scheduleStreamEntries = useCallback(
    (entries: StreamEntry[], options: { clearPending?: boolean } = {}) => {
      if (options.clearPending) {
        timersRef.current.forEach((timer) => window.clearTimeout(timer));
        timersRef.current = [];
        scheduledUntilRef.current = Date.now();
        setTypingAgent(null);
        setSpeakingAgent(null);
      }

      const visibleEntries = filterStreamEntries(entries);
      if (visibleEntries.length === 0) return;

      const displayEntries = visibleEntries.flatMap(splitStreamEntryForDisplay);
      const scheduledAt = Date.now();
      let nextDelay = displayScheduleStartDelay(
        scheduledAt,
        scheduledUntilRef.current,
        options.clearPending,
      );

      displayEntries.forEach((entry, index) => {
        const agentId = speakerForStreamEntry(entry);
        const thinkDuration = thinkDurationForStreamEntry(entry, index, Boolean(reduceMotion));

        if (agentId && thinkDuration > 0) {
          const typingTimer = window.setTimeout(() => {
            setTypingAgent(agentId);
          }, nextDelay);
          timersRef.current.push(typingTimer);
        }

        const appendTimer = window.setTimeout(() => {
          if (agentId) {
            setTypingAgent((current) => (current === agentId ? null : current));
            setSpeakingAgent(agentId);
          }
          setLiveQueue((current) => trimStreamEntries(dedupeStreamEntries([...current, entry])));
        }, nextDelay + thinkDuration);

        timersRef.current.push(appendTimer);

        if (agentId) {
          const clearSpeakingTimer = window.setTimeout(
            () => {
              setSpeakingAgent((current) => (current === agentId ? null : current));
            },
            nextDelay + thinkDuration + 1100,
          );
          timersRef.current.push(clearSpeakingTimer);
        }

        nextDelay += thinkDuration + gapDurationAfterStreamEntry(entry, Boolean(reduceMotion));
      });

      scheduledUntilRef.current = scheduledAt + nextDelay;
    },
    [reduceMotion],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (fiveSecondGuardRef.current) return;
      const now = Date.now();
      fiveSecondGuardRef.current = true;
      const guardAgent = AGENT_ORDER[1] ?? AGENT_ORDER[0]!;
      const entry: WatchUpdateEntry = {
        kind: "watch_update",
        id: `cold-start-${now}`,
        ts: now,
        updateType: "quiet_observation",
        title: agentWatchLocale === "en_US" ? "Agent check-in" : "Agent 巡检",
        content:
          agentWatchLocale === "en_US"
            ? "BTC is still loading fresh context, so I am waiting for the next live tick above $0 before judging."
            : "BTC 实时上下文还在刷新，所以先等下一跳价格再判断。",
        dedupeKey: `cold-start-${agentWatchLocale}`,
        agentId: guardAgent,
        symbols: ["BTC"],
        severity: "neutral",
      };
      const visibleEntries = filterStreamEntries([entry]);
      if (visibleEntries.length === 0) return;
      rememberScheduledEntries(visibleEntries, now);
      scheduleStreamEntries(visibleEntries);
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [agentWatchLocale, rememberScheduledEntries, scheduleStreamEntries]);

  useEffect(() => {
    if (!data || processedGeneratedAtRef.current === data.generatedAt) return;
    processedGeneratedAtRef.current = data.generatedAt;

    const now = Date.now();
    const entries = streamEntriesFromPayload(data);
    const { memory, mode } = ensureDirectorMemory(now);
    const opening = buildWatchDirectorOpening({
      now,
      mode,
      pool: data.pool,
      focus: data.focus,
      signals: marketSignalsRef.current,
      analysisEntries: entries,
      memory,
      locale: agentWatchLocale,
    });
    // Phase 6.0 round 2: director opening is disabled by default so it cannot create visible
    // self-intro chatter. WATCH_AMBIENT_CHATTER_ENABLED restores the legacy opening entries.
    const directorEntries = filterStreamEntries(
      opening.entries.length > 0 ? opening.entries : entries,
    );
    if (directorEntries.length === 0) return;
    rememberScheduledEntries(directorEntries, now);
    const clearPending = !hasScheduledInitialRef.current;
    hasScheduledInitialRef.current = true;
    fiveSecondGuardRef.current = true;
    scheduleStreamEntries(directorEntries, { clearPending });

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      scheduledUntilRef.current = Date.now();
      setTypingAgent(null);
      setSpeakingAgent(null);
    };
  }, [
    agentWatchLocale,
    data,
    ensureDirectorMemory,
    rememberScheduledEntries,
    scheduleStreamEntries,
  ]);

  useEffect(() => {
    if (!data?.pool) return;
    const now = Date.now();

    const existingEntries = streamEntriesFromPayload(data);
    const visibleEntries = trimStreamEntries(
      filterStreamEntries(dedupeStreamEntries([...existingEntries, ...liveQueue])),
    );
    const cutoff = now - DUPLICATE_CONTENT_WINDOW_MS * 2;
    for (const [key, ts] of Array.from(supplementalClaimRef.current.entries())) {
      if (ts < cutoff) supplementalClaimRef.current.delete(key);
    }

    const chatterPlan = buildChatterPlan({
      now,
      lastSpokeAt: lastSupplementalAtRef.current,
      pool: data.pool,
      signals: marketSignals,
      visibleEntries,
    });
    if (!chatterPlan.shouldSpeak) return;

    const preferredKinds = needsAgentDiversity(visibleEntries)
      ? (["agent_discussion", "agent_heartbeat"] as const)
      : chatterPlan.preferredKinds;
    let entry: ReturnType<typeof buildWatchSupplementalEntry> = null;

    for (const preferredKind of preferredKinds) {
      const candidate = buildWatchSupplementalEntry({
        now,
        pool: data.pool,
        focus: data.focus,
        signals: marketSignals,
        existingEntries: visibleEntries,
        preferredKind,
        locale: agentWatchLocale,
      });
      if (!candidate) continue;

      const lastClaimedAt = supplementalClaimRef.current.get(candidate.dedupeKey);
      if (lastClaimedAt !== undefined && now - lastClaimedAt <= DUPLICATE_CONTENT_WINDOW_MS) {
        continue;
      }

      entry = candidate;
      break;
    }

    if (!entry) return;

    const lastClaimedAt = supplementalClaimRef.current.get(entry.dedupeKey);
    if (lastClaimedAt !== undefined && now - lastClaimedAt <= DUPLICATE_CONTENT_WINDOW_MS) return;

    supplementalClaimRef.current.set(entry.dedupeKey, now);
    lastSupplementalAtRef.current = now;
    const visibleEntry = filterStreamEntries([entry]);
    if (visibleEntry.length === 0) return;
    rememberScheduledEntries(visibleEntry, now);
    scheduleStreamEntries(visibleEntry);
  }, [
    agentWatchLocale,
    data,
    liveQueue,
    marketSignals,
    rememberScheduledEntries,
    scheduleStreamEntries,
  ]);

  const loadMoreTimeline = useCallback(async () => {
    if (!timelineOldestTs || timelineLoadingMore) return;
    setTimelineLoadingMore(true);
    try {
      const payload = await fetchTimelineWindow({
        windowMinutes: PUBLIC_TIMELINE_FALLBACK_WINDOW_MINUTES,
        before: timelineOldestTs,
        limit: 30,
      });
      applyTimelinePayload(payload, "append");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[claw42] public timeline load more failed", error);
      }
    } finally {
      setTimelineLoadingMore(false);
    }
  }, [applyTimelinePayload, fetchTimelineWindow, timelineLoadingMore, timelineOldestTs]);

  useEffect(() => {
    if (!timelineHasMore || timelineLoadingMore) return;
    const sentinel = historySentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreTimeline();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreTimeline, timelineHasMore, timelineLoadingMore]);

  const handleDismissNewContent = useCallback(() => {
    dismissNewContent();
  }, [dismissNewContent]);

  const handleJumpToLatest = useCallback(async () => {
    await refreshHistory();
    dismissNewContent();
  }, [dismissNewContent, refreshHistory]);

  return (
    <section
      data-agent-watch-board
      className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-7xl px-4 pb-16 pt-24 md:px-8 md:pt-28"
    >
      <div className="space-y-7">
        <TopicHeader t={t} />
        {SHOW_TICKERS && (
          <>
            <CoinTickerStrip
              pool={data?.pool ?? tickerData?.pool}
              tickers={data?.tickers ?? tickerData?.tickers}
              labels={t.agentWatch.coinPool}
            />
            <CriticalNewsBanner
              debate={data?.newsDebates?.[0] ?? null}
              labels={t.agentWatch.newsDebate}
            />
            <MarketEventFeed
              signals={marketSignals}
              labels={t.agentWatch.marketEvent}
              locale={agentWatchLocale}
            />
            <NewsFeedTicker debates={data?.newsDebates ?? []} labels={t.agentWatch.newsDebate} />
          </>
        )}

        {SHOW_TICKERS && (
          <NewContentBanner
            visible={hasNewContent}
            onDismiss={handleDismissNewContent}
            onJumpToLatest={() => {
              void handleJumpToLatest();
            }}
          />
        )}

        <DecisionTimeline
          events={timelineEvents}
          loading={timelineLoading}
          loadingMore={timelineLoadingMore}
          hasMore={timelineHasMore}
          onLoadMore={loadMoreTimeline}
          sentinelRef={(node) => {
            historySentinelRef.current = node;
          }}
        />

        <p className="text-white/42 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs leading-relaxed">
          {agentWatchLocale === "en_US"
            ? "Risk notice: This page is generated by AI from public market data for information display only and does not constitute investment advice. Please make trading decisions based on your own risk tolerance."
            : "风险提示：本页面内容由 AI 根据公开行情数据自动生成，仅用于信息展示，不构成投资建议。请结合自身风险承受能力判断，交易决策由用户自行承担。"}
        </p>

        {(isLoading || isHistoryLoading || timelineLoading) && timelineEvents.length === 0 && (
          <p className="text-center text-sm text-white/35">{t.agentWatch.loadingHistory}</p>
        )}

        <motion.a
          href="#"
          title={agentWatchLocale === "en_US" ? "Coming soon" : "敬请期待"}
          whileHover={reduceMotion ? undefined : { y: -3 }}
          className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#111] p-6 md:flex-row md:items-center md:p-7"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
              Claw 42 Agent
            </p>
            <h2 className="mt-2 text-xl font-bold text-white md:text-2xl">
              {t.agentWatch.bottomCta}
            </h2>
          </div>
          <span className="text-2xl text-white/55">→</span>
        </motion.a>
      </div>
    </section>
  );
}
