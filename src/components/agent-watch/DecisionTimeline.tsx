"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getTeamMember, type TeamMemberId } from "@/lib/team/teamRegistry";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { CitationChip } from "./CitationChip";
import { SignalCard } from "./SignalCard";
import { TradeCardBlock } from "./TradeCardBlock";
import { ZeroState } from "./ZeroState";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function memberName(memberId: TeamMemberId, team: ReturnType<typeof useI18n>["t"]["team"]) {
  return team[memberId]?.displayName ?? getTeamMember(memberId).id;
}

function EventBody({ event }: { event: PublicTimelineEvent }) {
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
    const payload = event.payload;
    const rationales = Object.entries(payload.rationaleByMember);
    return (
      <div className="space-y-4">
        <TradeCardBlock decision={event.payload.tradeDecision} />
        {rationales.length > 0 && (
          <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer text-sm font-bold text-white/78">
              {t.agentWatch.timeline.showProcess}
            </summary>
            <div className="mt-3 space-y-3">
              {rationales.map(([memberId, text]) => (
                <div key={memberId} className="rounded-xl bg-white/[0.035] p-3 text-sm leading-relaxed text-white/70">
                  <div className="mb-1 font-bold text-white">
                    {memberName(memberId as TeamMemberId, t.team)}
                  </div>
                  {text}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(payload.citationsByMember?.[memberId as TeamMemberId] ?? []).map(
                      (evidenceId: string, index: number) => (
                        <CitationChip key={evidenceId} evidenceId={evidenceId} index={index} />
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (event.payload.kind === "team_discussion") {
    return (
      <div className="space-y-3 rounded-2xl border border-violet-300/20 bg-violet-950/[0.10] p-4">
        {event.payload.turns.map((turn, index) => (
          <div key={`${turn.memberId}-${index}`} className="rounded-xl bg-black/20 p-3">
            <div className="text-xs font-bold text-violet-200">
              {memberName(turn.memberId, t.team)}
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
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  sentinelRef,
}: {
  events: PublicTimelineEvent[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sentinelRef?: (node: HTMLDivElement | null) => void;
}) {
  const { t } = useI18n();
  const oneHourCutoff = useMemo(() => Date.now() - 60 * 60 * 1000, []);
  let renderedBoundary = false;

  if (!loading && events.length === 0) {
    return <ZeroState title={t.agentWatch.emptyState.title} subtitle={t.agentWatch.emptyState.subtitle} />;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-200/75">
            {t.agentWatch.timeline.recentHour}
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">{t.agentWatch.timeline.title}</h2>
        </div>
        {loading && <span className="text-xs text-white/45">{t.agentWatch.loadingHistory}</span>}
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
                  <span className="font-mono text-xs text-white/35">{formatTime(event.ts)}</span>
                  {event.evidenceIds.map((evidenceId, index) => (
                    <CitationChip key={evidenceId} evidenceId={evidenceId} index={index} />
                  ))}
                </div>
                <EventBody event={event} />
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
  );
}
