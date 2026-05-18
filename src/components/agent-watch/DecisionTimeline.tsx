"use client";

import React from "react";
import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { usePipelineReplay } from "@/lib/team/usePipelineReplay";
import { useTeamActivityStatus } from "@/lib/team/useTeamActivityStatus";
import { getTeamMember, type TeamMemberId } from "@/lib/team/teamRegistry";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { mapPublicDecisionAgentToTeamMember } from "@/lib/watch/publicDecisionAgents";
import type { MarketTickerPayload } from "@/modules/agent-watch/types";
import { CitationChip, EvidenceMapProvider } from "./CitationChip";
import { ProcessAccordion } from "./ProcessAccordion";
import { SignalCard } from "./SignalCard";
import { TeamWorkflowPanel } from "./TeamWorkflowPanel";
import { TradeCardBlock } from "./TradeCardBlock";
import { ZeroState } from "./ZeroState";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function memberName(memberId: TeamMemberId, team: ReturnType<typeof useI18n>["t"]["team"]) {
  return team[memberId]?.displayName ?? getTeamMember(memberId).id;
}

function memberIdForTurn(
  turn: Extract<PublicTimelineEvent["payload"], { kind: "team_discussion" }>["turns"][number],
) {
  if (turn.memberId) return turn.memberId;
  return turn.agentId ? mapPublicDecisionAgentToTeamMember(turn.agentId) : "pm";
}

function EventBody({
  event,
  onReplayTrigger,
}: {
  event: PublicTimelineEvent;
  onReplayTrigger?: (recordId: string) => void;
}) {
  const { t } = useI18n();

  if (event.payload.kind === "market_signal") return <SignalCard event={event} />;

  if (event.payload.kind === "news") {
    return (
      <div className="rounded-2xl border border-sky-300/20 bg-sky-950/[0.10] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-300/25 bg-sky-300/[0.08] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100">
            News
          </span>
          {event.payload.symbols.map((symbol) => (
            <span key={symbol} className="font-mono text-xs font-bold text-white/75">
              ${symbol}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <CitationChip evidenceId={event.payload.evidenceId} index={0} />
        </div>
      </div>
    );
  }

  if (event.payload.kind === "pm_decision") {
    return (
      <div className="space-y-4">
        <TradeCardBlock decision={event.payload.tradeDecision} />
        <ProcessAccordion payload={event.payload} onReplayTrigger={onReplayTrigger} />
      </div>
    );
  }

  if (event.payload.kind === "team_discussion") {
    return (
      <div className="space-y-3 rounded-2xl border border-violet-300/20 bg-violet-950/[0.10] p-4">
        {event.payload.turns.map((turn, index) => (
          <div key={`${memberIdForTurn(turn)}-${index}`} className="rounded-xl bg-black/20 p-3">
            <div className="text-xs font-bold text-violet-200">
              {memberName(memberIdForTurn(turn), t.team)}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{turn.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {turn.citations.map((evidenceId, citationIndex) => (
                <CitationChip key={evidenceId} evidenceId={evidenceId} index={citationIndex} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function DecisionTimeline({
  events,
  evidenceMap,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  sentinelRef,
  marketSnapshot,
}: {
  events: PublicTimelineEvent[];
  evidenceMap: Record<string, NewsEvidence>;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sentinelRef?: (node: HTMLDivElement | null) => void;
  marketSnapshot?: MarketTickerPayload | null;
}) {
  const { t } = useI18n();
  const [replayRequest, setReplayRequest] = useState<{ recordId: string | null; key: number }>({
    recordId: null,
    key: 0,
  });
  const statuses = useTeamActivityStatus({ events, loading });
  const replay = usePipelineReplay({
    recordId: replayRequest.recordId,
    enabled: Boolean(replayRequest.recordId),
    replayKey: replayRequest.key,
    triggerReason: "user_expand",
  });
  const triggerReplay = useCallback((recordId: string) => {
    setReplayRequest((current) => ({
      recordId,
      key: current.key + 1,
    }));
  }, []);
  const oneHourCutoff = useMemo(() => Date.now() - 60 * 60 * 1000, []);
  let renderedBoundary = false;

  if (!loading && events.length === 0) {
    return (
      <EvidenceMapProvider value={evidenceMap}>
        <div className="space-y-4">
          <TeamWorkflowPanel statuses={statuses} replayActiveMemberId={replay.activeMemberId} />
          <ZeroState
            title={t.agentWatch.emptyState.title}
            subtitle={t.agentWatch.emptyState.subtitle}
            marketSnapshot={marketSnapshot}
          />
        </div>
      </EvidenceMapProvider>
    );
  }

  return (
    <EvidenceMapProvider value={evidenceMap}>
      <div className="space-y-4">
        <TeamWorkflowPanel statuses={statuses} replayActiveMemberId={replay.activeMemberId} />
        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-200/75">
                {t.agentWatch.timeline.recentHour}
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">{t.agentWatch.timeline.title}</h2>
            </div>
            {loading && (
              <span className="text-xs text-white/45">{t.agentWatch.loadingHistory}</span>
            )}
          </div>

          <div className="space-y-4">
            {events.map((event) => {
              const showBoundary = !renderedBoundary && event.ts < oneHourCutoff;
              if (showBoundary) renderedBoundary = true;
              return (
                <div key={event.id}>
                  {showBoundary && (
                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs font-bold text-white/35">
                        {t.agentWatch.timeline.olderWindow}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                  )}
                  <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-white/70">
                        {t.agentWatch.timeline[event.sourceTrigger]}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-white/45">
                        {event.importance}
                      </span>
                      <span className="font-mono text-xs text-white/35">
                        {formatTime(event.ts)}
                      </span>
                      {event.evidenceIds.map((evidenceId, index) => (
                        <CitationChip key={evidenceId} evidenceId={evidenceId} index={index} />
                      ))}
                    </div>
                    <EventBody event={event} onReplayTrigger={triggerReplay} />
                  </article>
                </div>
              );
            })}
          </div>

          <div ref={sentinelRef} className="h-6" />
          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="mt-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {loadingMore ? t.agentWatch.loadingMore : t.agentWatch.loadMore}
            </button>
          )}
        </section>
      </div>
    </EvidenceMapProvider>
  );
}
