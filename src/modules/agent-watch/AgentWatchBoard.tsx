"use client";

import { useEffect, useMemo, useState } from "react";
import { deriveAgentCardViews } from "@/lib/agentViewGenerator";
import { detectFocusEvent } from "@/lib/focusEventDetector";
import { useI18n } from "@/i18n/I18nProvider";
import { AGENT_ORDER } from "./agents";
import { useAgentAnalysis } from "./hooks/useAgentAnalysis";
import { useAgentHistory } from "./hooks/useAgentHistory";
import { useMarketEventFeed } from "./hooks/useMarketEventFeed";
import type { AgentCardView, AgentId } from "./types";
import { AgentCardStage } from "./components/AgentCardStage";
import { CoinTickerStrip } from "./components/CoinTickerStrip";
import { CollapsedHistory } from "./components/CollapsedHistory";
import { FocusEventCard } from "./components/FocusEventCard";
import { MarketEventFeed } from "./components/MarketEventFeed";
import { TopicHeader } from "./components/TopicHeader";

function latestActivityMinutes(generatedAt: number | undefined, signalTs: number[]) {
  const latestTs = Math.max(generatedAt ?? 0, ...signalTs, 0);
  if (latestTs <= 0) return 1;
  return Math.max(1, Math.round((Date.now() - latestTs) / 60_000));
}

export function AgentWatchBoard() {
  const { t, locale } = useI18n();
  const isZh = locale === "zh_CN";
  const {
    entries: historyMessages,
    isLoading: isHistoryLoading,
    refreshHistory,
  } = useAgentHistory({ enabled: isZh, initialLimit: 60 });
  const { data, isLoading, hasNewContent, dismissNewContent } = useAgentAnalysis({
    enabled: isZh,
  });
  const { signals: marketSignals } = useMarketEventFeed({ enabled: isZh, limit: 12 });
  const [cardViews, setCardViews] = useState<Record<AgentId, AgentCardView> | null>(null);

  useEffect(() => {
    setCardViews((current) =>
      deriveAgentCardViews({
        analysis: data,
        signals: marketSignals,
        previousViews: current ?? undefined,
      }),
    );
  }, [data, marketSignals]);

  useEffect(() => {
    if (!hasNewContent) return;
    void refreshHistory().finally(dismissNewContent);
  }, [dismissNewContent, hasNewContent, refreshHistory]);

  const activeCardViews = useMemo(
    () =>
      cardViews ??
      deriveAgentCardViews({
        analysis: data,
        signals: marketSignals,
      }),
    [cardViews, data, marketSignals],
  );

  const focusEvent = useMemo(
    () => detectFocusEvent(marketSignals, activeCardViews),
    [activeCardViews, marketSignals],
  );
  const silentMinutes = latestActivityMinutes(
    focusEvent?.ts ?? data?.generatedAt,
    marketSignals.map((signal) => signal.ts),
  );

  return (
    <section
      data-agent-watch-board
      className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-7xl px-4 pb-16 pt-24 md:px-8 md:pt-28"
    >
      <div className="space-y-5">
        <TopicHeader t={t} />
        <CoinTickerStrip
          pool={data?.pool}
          tickers={data?.tickers}
          labels={t.agentWatch.coinPool}
        />
        <MarketEventFeed signals={marketSignals} labels={t.agentWatch.marketEvent} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {AGENT_ORDER.map((agentId) => (
            <AgentCardStage
              key={agentId}
              view={activeCardViews[agentId]}
              labels={t.agentWatch.agentCard}
            />
          ))}
        </div>

        <FocusEventCard
          event={focusEvent}
          labels={t.agentWatch.stageFocus}
          silentMinutes={silentMinutes}
        />

        <CollapsedHistory messages={historyMessages} labels={t.agentWatch.history} />

        {(isLoading || isHistoryLoading) && historyMessages.length === 0 && (
          <p className="text-center text-sm text-white/35">{t.agentWatch.loadingHistory}</p>
        )}
      </div>
    </section>
  );
}
