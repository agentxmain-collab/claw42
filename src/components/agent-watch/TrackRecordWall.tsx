"use client";

import React, { useEffect, useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";
import type { TeamMemberWinrate } from "@/lib/team/computeTeamWinrates";
import { getTeamDisplayName } from "@/lib/team/teamDisplayNames";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import { AIDisclaimer } from "./AIDisclaimer";
import { RecordSourceBadge, type RecordSourceBadgeType } from "./RecordSourceBadge";
import { TeamMemberCard } from "./TeamMemberCard";

export function TrackRecordWall({ winrates }: { winrates: TeamMemberWinrate[] }) {
  const { t, locale } = useI18n();
  const winrateByMember = useMemo(
    () => new Map(winrates.map((winrate) => [winrate.memberId, winrate])),
    [winrates],
  );
  const summary = useMemo(() => summarize(winrates), [winrates]);

  useEffect(() => {
    trackEvent("watch_track_wall_view", {
      member_count: TEAM_MEMBER_IDS.length,
      total_decisions: summary.totalDecisions,
      record_source: summary.source,
    });
  }, [summary.source, summary.totalDecisions]);

  return (
    <section
      aria-labelledby="watch-track-record-wall-title"
      className="rounded-[28px] border border-white/10 bg-[#0d0d0f]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <RecordSourceBadge
              source={summary.source}
              label={t.team.trackRecord.source[summary.source]}
            />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Claw 42 Watch Team
            </span>
          </div>
          <h2 id="watch-track-record-wall-title" className="mt-3 text-2xl font-black text-white">
            {t.team.trackRecord.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            {t.team.trackRecord.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 md:min-w-[380px]">
          <SummaryMetric
            label={t.team.trackRecord.totalDecisions}
            value={String(summary.totalDecisions)}
          />
          <SummaryMetric
            label={t.team.trackRecord.overallWinRate}
            value={formatPercent(summary.overallWinRate)}
          />
          <SummaryMetric
            label={t.team.trackRecord.teamNetReturn7d}
            value={formatSigned(summary.netReturn7d)}
          />
        </div>
      </div>

      {summary.totalDecisions === 0 && (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/50">
          {t.team.trackRecord.noRecords}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {TEAM_MEMBER_IDS.map((memberId) => {
          const winrate = winrateByMember.get(memberId) ?? emptyWinrate(memberId);
          return (
            <TeamMemberCard
              key={memberId}
              memberId={memberId}
              displayName={getTeamDisplayName(memberId, locale)}
              labels={t.team}
              winrate={winrate}
              onClick={(clickedMemberId) =>
                trackEvent("team_member_card_click", {
                  member_id: clickedMemberId,
                  total_decisions: winrate.totalDecisions,
                })
              }
            />
          );
        })}
      </div>

      <div className="mt-5">
        <AIDisclaimer>{t.team.trackRecord.aiDisclaimer}</AIDisclaimer>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="text-[11px] font-bold text-white/40">{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-white">{value}</div>
    </div>
  );
}

function summarize(winrates: TeamMemberWinrate[]) {
  const totalDecisions = winrates.reduce((sum, item) => sum + item.totalDecisions, 0);
  const wins = winrates.reduce((sum, item) => sum + item.wins, 0);
  const netReturn7d = winrates.reduce((sum, item) => sum + item.netReturn7d, 0);
  const source = aggregateSource(winrates);
  return {
    totalDecisions,
    overallWinRate: totalDecisions === 0 ? 0 : wins / totalDecisions,
    netReturn7d,
    source,
  };
}

function aggregateSource(winrates: TeamMemberWinrate[]): RecordSourceBadgeType {
  const sourceCounts = new Map<RecordSourceBadgeType, number>();
  for (const winrate of winrates) {
    for (const [source, count] of Object.entries(winrate.recordSourceMix)) {
      if (source === "legacy" || count === 0) continue;
      sourceCounts.set(
        source as RecordSourceBadgeType,
        (sourceCounts.get(source as RecordSourceBadgeType) ?? 0) + count,
      );
    }
  }
  if (sourceCounts.size === 0) return "none";
  if (sourceCounts.size > 1) return "mixed";
  return Array.from(sourceCounts.keys())[0] ?? "none";
}

function emptyWinrate(memberId: TeamMemberId): TeamMemberWinrate {
  return {
    memberId,
    totalDecisions: 0,
    wins: 0,
    winRate: 0,
    lastFiveWinRate: 0,
    netReturn7d: 0,
    recordSourceMix: {
      live: 0,
      paper: 0,
      legacy: 0,
      backtest: 0,
    },
    sampleSizeWarning: true,
  };
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number) {
  const rounded = value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${rounded}%`;
}
