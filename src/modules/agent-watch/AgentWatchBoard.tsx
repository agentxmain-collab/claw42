"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_ORDER } from "./agents";
import { useAgentAnalysis } from "./hooks/useAgentAnalysis";
import { useAgentHistory } from "./hooks/useAgentHistory";
import { useMarketEventFeed } from "./hooks/useMarketEventFeed";
import type { AgentId, AgentStatus, AgentWatchMessage, HistoryMessageEntry } from "./types";
import { AgentRowCard } from "./components/AgentRowCard";
import { CoinTickerStrip } from "./components/CoinTickerStrip";
import { MarketEventFeed } from "./components/MarketEventFeed";
import { MessageStream, type MessageStreamHandle } from "./components/MessageStream";
import { NewContentBanner } from "./components/NewContentBanner";
import { TopicHeader } from "./components/TopicHeader";

const DUPLICATE_CONTENT_WINDOW_MS = 5 * 60_000;

function warnDuplicateMessage(reason: string, message: AgentWatchMessage) {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[claw42] duplicate watch message skipped", {
    reason,
    id: message.id,
    agentId: message.agentId,
    timestamp: message.timestamp,
  });
}

function dedupeAgentMessages(messages: AgentWatchMessage[]) {
  const seenIds = new Set<string>();
  const recentContent = new Map<string, number>();
  const unique: AgentWatchMessage[] = [];

  for (const message of messages) {
    if (seenIds.has(message.id)) {
      warnDuplicateMessage("id", message);
      continue;
    }

    const contentKey = `${message.agentId}:${message.content.trim()}`;
    const lastTimestamp = recentContent.get(contentKey);
    if (
      lastTimestamp !== undefined &&
      Math.abs(message.timestamp - lastTimestamp) <= DUPLICATE_CONTENT_WINDOW_MS
    ) {
      warnDuplicateMessage("content", message);
      continue;
    }

    seenIds.add(message.id);
    recentContent.set(contentKey, message.timestamp);
    unique.push(message);
  }

  return unique;
}

function keepFivePerAgent(messages: AgentWatchMessage[]) {
  const kept = new Set<string>();
  for (const agentId of AGENT_ORDER) {
    messages
      .filter((message) => message.agentId === agentId)
      .slice(-5)
      .forEach((message) => kept.add(message.id));
  }
  return messages.filter((message) => kept.has(message.id));
}

function mergeHistoryAndLive(
  history: HistoryMessageEntry[],
  live: AgentWatchMessage[],
): AgentWatchMessage[] {
  const liveIds = new Set(live.map((message) => message.id));
  const historyAsMessages: AgentWatchMessage[] = history
    .filter((entry) => !liveIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      agentId: entry.agentId,
      content: entry.content,
      timestamp: entry.generatedAt,
    }));
  return dedupeAgentMessages([...historyAsMessages, ...live]);
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
  const messageStreamRef = useRef<MessageStreamHandle>(null);
  const timersRef = useRef<number[]>([]);
  const [liveQueue, setLiveQueue] = useState<AgentWatchMessage[]>([]);
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

    data.stream.forEach((item, index) => {
      const typingTimer = window.setTimeout(() => {
        setTypingAgent(item.agentId);
      }, index * 1600);
      const appendTimer = window.setTimeout(
        () => {
          setTypingAgent(null);
          setSpeakingAgent(item.agentId);
          setLiveQueue((current) =>
            keepFivePerAgent(
              dedupeAgentMessages([
                ...current,
                {
                  id: `${data.generatedAt}-${item.agentId}-${index}`,
                  agentId: item.agentId,
                  content: item.content,
                  timestamp: data.generatedAt,
                },
              ]),
            ),
          );
        },
        index * 1600 + 800,
      );
      const clearSpeakingTimer = window.setTimeout(
        () => {
          setSpeakingAgent((current) => (current === item.agentId ? null : current));
        },
        index * 1600 + 1900,
      );
      timersRef.current.push(typingTimer, appendTimer, clearSpeakingTimer);
    });

    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [data]);

  const combinedMessages = useMemo(
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
    messageStreamRef.current?.scrollToLatest();
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
      <div className="space-y-5">
        <TopicHeader t={t} />
        <CoinTickerStrip pool={data?.pool} tickers={data?.tickers} labels={t.agentWatch.coinPool} />
        <MarketEventFeed signals={marketSignals} labels={t.agentWatch.marketEvent} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

        <MessageStream
          ref={messageStreamRef}
          messages={combinedMessages}
          typingAgent={typingAgent}
          emptyLabel={t.agentWatch.emptyHistory}
        />

        {(isLoading || isHistoryLoading) && combinedMessages.length === 0 && (
          <p className="text-center text-sm text-white/35">{t.agentWatch.loadingHistory}</p>
        )}

        <motion.a
          href="#"
          title="敬请期待"
          whileHover={reduceMotion ? undefined : { y: -3 }}
          className="card-glow flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#111] p-5 md:flex-row md:items-center md:p-6"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#b49cff]">
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
