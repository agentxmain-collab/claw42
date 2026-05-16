import React from "react";
import type { Dict, Locale } from "@/i18n/types";
import type { TeamMemberWinrate } from "@/lib/team/computeTeamWinrates";
import { getTeamDisplayName } from "@/lib/team/teamDisplayNames";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";

type TeamTrackRecordLabels = Dict["team"]["trackRecord"];

export function TeamTrackRecordPanel({
  labels,
  locale,
  winrates,
}: {
  labels: TeamTrackRecordLabels;
  locale: Locale;
  winrates?: TeamMemberWinrate[];
}) {
  const winrateByMember = new Map((winrates ?? []).map((item) => [item.memberId, item]));
  const totalDecisions = (winrates ?? []).reduce((sum, item) => sum + item.totalDecisions, 0);
  const hasTrackRecord = totalDecisions > 0;

  return (
    <section className="team-track-panel" aria-label={labels.compactTitle}>
      <div className="team-track-head">
        <div>
          <div className="team-track-title">{labels.compactTitle}</div>
          <div className="team-track-sub">
            {totalDecisions > 0 ? labels.subtitle : labels.noRecords}
          </div>
        </div>
        <span className="team-track-caution">{labels.sampleCautionBadge}</span>
      </div>
      {hasTrackRecord ? (
        <div className="team-track-grid">
          {TEAM_MEMBER_IDS.map((memberId) => {
            const winrate = winrateByMember.get(memberId) ?? emptyWinrate(memberId);
            return (
              <TeamTrackChip
                key={memberId}
                memberId={memberId}
                displayName={getTeamDisplayName(memberId, locale)}
                labels={labels}
                winrate={winrate}
              />
            );
          })}
        </div>
      ) : (
        <div className="team-track-empty">{labels.noRecords}</div>
      )}
    </section>
  );
}

function TeamTrackChip({
  memberId,
  displayName,
  labels,
  winrate,
}: {
  memberId: TeamMemberId;
  displayName: string;
  labels: TeamTrackRecordLabels;
  winrate: TeamMemberWinrate;
}) {
  const initials = displayName
    .replace(/[\[\]]/g, "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="team-track-chip" data-member-id={memberId}>
      <span className="team-track-avatar" aria-hidden="true">
        {initials || "AI"}
      </span>
      <span className="team-track-copy">
        <span className="team-track-name">{displayName}</span>
        <span className="team-track-metrics">
          <span>
            {labels.lastFiveWinRate} {formatPercent(winrate.lastFiveWinRate)}
          </span>
          <span>
            {labels.winRate} {formatPercent(winrate.winRate)}
          </span>
          <span>
            {labels.decisions} {winrate.totalDecisions}
          </span>
        </span>
        {winrate.sampleSizeWarning ? (
          <span className="team-track-sample">{labels.sampleSizeSmall}</span>
        ) : null}
      </span>
    </div>
  );
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
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}
