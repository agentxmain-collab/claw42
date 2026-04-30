"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_ORDER } from "./agents";
import { useAgentAnalysis } from "./hooks/useAgentAnalysis";
import { useAgentHistory } from "./hooks/useAgentHistory";
import { useMarketEventFeed } from "./hooks/useMarketEventFeed";
import type {
  AgentMessage,
  AgentId,
  AgentStatus,
  HistoryMessageEntry,
  StreamEntry,
  WatchUpdateEntry,
} from "./types";
import { AgentRowCard } from "./components/AgentRowCard";
import { CoinTickerStrip } from "./components/CoinTickerStrip";
import { MarketEventFeed } from "./components/MarketEventFeed";
import { Stream, type StreamHandle } from "./components/Stream";
import { NewContentBanner } from "./components/NewContentBanner";
import { TopicHeader } from "./components/TopicHeader";
import { buildWatchSupplementalEntry } from "./utils/watchSupplementalUpdates";

const DUPLICATE_CONTENT_WINDOW_MS = 5 * 60_000;
const STREAM_MAX_ENTRIES = 48;
const STREAM_ENTRY_GAP_MS = 400;

function isAgentMessage(entry: StreamEntry): entry is AgentMessage {
  return entry.kind === "agent_message";
}

function isWatchUpdate(entry: StreamEntry): entry is WatchUpdateEntry {
  return entry.kind === "watch_update";
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

    if (isAgentMessage(entry) || isWatchUpdate(entry)) {
      const contentKey = isAgentMessage(entry)
        ? `agent:${entry.agentId}:${entry.content.trim()}`
        : `watch:${entry.dedupeKey}:${entry.content.trim()}`;
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

function mergeHistoryAndLive(
  history: HistoryMessageEntry[],
  live: StreamEntry[],
): StreamEntry[] {
  const liveIds = new Set(live.map((entry) => entry.id));
  const historyAsMessages: AgentMessage[] = history
    .filter((entry) => !liveIds.has(entry.id))
    .map((entry) => ({
      kind: "agent_message",
      id: entry.id,
      ts: entry.generatedAt,
      agentId: entry.agentId,
      content: entry.content,
      triggerSignalId: entry.triggerSignalId ?? `history-${entry.id}`,
    }));
  return trimStreamEntries(dedupeStreamEntries([...historyAsMessages, ...live]));
}

function streamEntriesFromPayload(data: NonNullable<ReturnType<typeof useAgentAnalysis>["data"]>) {
  if (data.streamEntries?.length) return data.streamEntries;

  return data.stream.map(
    (item, index): AgentMessage => ({
      kind: "agent_message",
      id: `${data.generatedAt}-${item.agentId}-${index}`,
      ts: data.generatedAt,
      agentId: item.agentId,
      content: item.content,
      triggerSignalId: `legacy-${data.generatedAt}-${item.agentId}-${index}`,
    }),
  );
}

function randomThinkDurationMs() {
  return 800 + Math.round(Math.random() * 1200);
}

export function AgentWatchBoard() {
  const { t, locale } = useI18n();
  const isZh = locale === "zh_CN";
  const reduceMotion = useReducedMotion();
  const {
    entries: historyMessages,
    isLoading: isHistoryLoading,
    refreshHistory,
  } = useAgentHistory({ enabled: isZh, initialLimit: 60 });
  const { data, isLoading, hasNewContent, dismissNewContent } = useAgentAnalysis({
    enabled: isZh,
  });
  const { signals: marketSignals } = useMarketEventFeed({ enabled: isZh, limit: 12 });
  const processedGeneratedAtRef = useRef<number | null>(null);
  const streamRef = useRef<StreamHandle>(null);
  const timersRef = useRef<number[]>([]);
  const supplementalClaimRef = useRef(new Map<string, number>());
  const lastSupplementalAtRef = useRef(0);
  const [liveQueue, setLiveQueue] = useState<StreamEntry[]>([]);
  const [typingAgent, setTypingAgent] = useState<AgentId | null>(null);
  const [speakingAgent, setSpeakingAgent] = useState<AgentId | null>(null);

  useEffect(() => {
    if (hasNewContent) void refreshHistory();
  }, [hasNewContent, refreshHistory]);

  useEffect(() => {
    if (!data || processedGeneratedAtRef.current === data.generatedAt) return;
    processedGeneratedAtRef.current = data.generatedAt;

    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];

    const entries = streamEntriesFromPayload(data);

    let nextDelay = 0;
    entries.forEach((entry) => {
      const agentId = isAgentMessage(entry) ? entry.agentId : null;
      const thinkDuration = randomThinkDurationMs();
      const typingTimer = window.setTimeout(() => {
        setTypingAgent(agentId);
      }, nextDelay);
      const appendTimer = window.setTimeout(() => {
        setTypingAgent(null);
        setSpeakingAgent(agentId);
        setLiveQueue((current) =>
          trimStreamEntries(
            dedupeStreamEntries([
              ...current,
              entry,
            ]),
          ),
        );
      }, nextDelay + thinkDuration);
      const clearSpeakingTimer = window.setTimeout(() => {
        setSpeakingAgent((current) => (current === agentId ? null : current));
      }, nextDelay + thinkDuration + 1100);
      timersRef.current.push(typingTimer, appendTimer, clearSpeakingTimer);
      nextDelay += thinkDuration + STREAM_ENTRY_GAP_MS;
    });

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [data]);

  useEffect(() => {
    if (!data?.pool) return;
    const now = Date.now();
    if (now - lastSupplementalAtRef.current < 25_000) return;

    const existingEntries = streamEntriesFromPayload(data);
    const entry = buildWatchSupplementalEntry({
      now,
      pool: data.pool,
      focus: data.focus,
      signals: marketSignals,
      existingEntries,
    });
    if (!entry) return;

    const cutoff = now - DUPLICATE_CONTENT_WINDOW_MS * 2;
    for (const [key, ts] of Array.from(supplementalClaimRef.current.entries())) {
      if (ts < cutoff) supplementalClaimRef.current.delete(key);
    }

    const lastClaimedAt = supplementalClaimRef.current.get(entry.dedupeKey);
    if (lastClaimedAt !== undefined && now - lastClaimedAt <= DUPLICATE_CONTENT_WINDOW_MS) return;

    supplementalClaimRef.current.set(entry.dedupeKey, now);
    lastSupplementalAtRef.current = now;
    setLiveQueue((current) =>
      trimStreamEntries(
        dedupeStreamEntries([
          ...current,
          entry,
        ]),
      ),
    );
  }, [data, marketSignals]);

  const combinedEntries = useMemo(
    () => mergeHistoryAndLive(historyMessages, liveQueue),
    [historyMessages, liveQueue],
  );
  const focusByAgent = useMemo(
    () => new Map(data?.focus?.map((focus) => [focus.agentId, focus]) ?? []),
    [data?.focus],
  );

  const handleDismissNewContent = useCallback(() => {
    dismissNewContent();
  }, [dismissNewContent]);

  const handleJumpToLatest = useCallback(async () => {
    await refreshHistory();
    streamRef.current?.scrollToLatest();
    dismissNewContent();
  }, [dismissNewContent, refreshHistory]);
  const statusForAgent = useCallback(
    (agentId: AgentId): AgentStatus =>
      typingAgent === agentId ? "thinking" : speakingAgent === agentId ? "speaking" : "idle",
    [speakingAgent, typingAgent],
  );

  return (
    <section
      data-agent-watch-board
      className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-7xl px-4 pb-16 pt-24 md:px-8 md:pt-28"
    >
      <div className="space-y-7">
        <TopicHeader t={t} />
        <CoinTickerStrip
          pool={data?.pool}
          tickers={data?.tickers}
          labels={t.agentWatch.coinPool}
        />
        <MarketEventFeed signals={marketSignals} labels={t.agentWatch.marketEvent} />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {AGENT_ORDER.map((agentId) => (
            <AgentRowCard
              key={agentId}
              agentId={agentId}
              focus={focusByAgent.get(agentId) ?? null}
              status={statusForAgent(agentId)}
              statusLabels={t.agentWatch.sidebarStatus}
              focusLabels={t.agentWatch.focusCard}
            />
          ))}
        </div>

        <NewContentBanner
          visible={hasNewContent}
          onDismiss={handleDismissNewContent}
          onJumpToLatest={() => {
            void handleJumpToLatest();
          }}
        />

        <Stream
          ref={streamRef}
          entries={combinedEntries}
          typingAgent={typingAgent}
          emptyLabel={t.agentWatch.emptyHistory}
        />

        {(isLoading || isHistoryLoading) && combinedEntries.length === 0 && (
          <p className="text-center text-sm text-white/35">{t.agentWatch.loadingHistory}</p>
        )}

        <motion.a
          href="#"
          title="敬请期待"
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
