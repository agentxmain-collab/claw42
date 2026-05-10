import React from "react";
import Image from "next/image";
import type { Dict } from "@/i18n/types";
import { getTeamMember, type TeamMemberId } from "@/lib/team/teamRegistry";
import type { TeamMemberWinrate } from "@/lib/team/computeTeamWinrates";
import { RecordSourceBadge, type RecordSourceBadgeType } from "./RecordSourceBadge";

type TeamLabels = Dict["team"];

export function TeamMemberCard({
  memberId,
  displayName,
  labels,
  winrate,
  onClick,
}: {
  memberId: TeamMemberId;
  displayName: string;
  labels: TeamLabels;
  winrate: TeamMemberWinrate;
  onClick?: (memberId: TeamMemberId) => void;
}) {
  const member = getTeamMember(memberId);
  const memberLabels = labels[memberId];
  const source = dominantSource(winrate);

  return (
    <button
      type="button"
      aria-label={memberLabels.ariaLabel}
      onClick={() => onClick?.(memberId)}
      className="group min-h-[212px] rounded-2xl border border-white/10 bg-[#111]/95 p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition hover:border-[#7650ff]/50 hover:bg-[#15121f]"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <Image
            src={member.avatarPath}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
            loading="lazy"
          />
          <span className="sr-only">{displayName}</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black text-white">{displayName}</h3>
            <RecordSourceBadge source={source} label={labels.trackRecord.source[source]} />
          </div>
          <p className="mt-1 text-xs font-bold text-[#a696ff]">{memberLabels.roleTitle}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/50">
            {memberLabels.shortBio}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Metric label={labels.trackRecord.winRate} value={formatPercent(winrate.winRate)} />
        <Metric label={labels.trackRecord.decisions} value={String(winrate.totalDecisions)} />
        <Metric label={labels.trackRecord.wins} value={String(winrate.wins)} />
        <Metric label={labels.trackRecord.netReturn7d} value={formatSigned(winrate.netReturn7d)} />
      </div>

      {winrate.sampleSizeWarning && (
        <p className="text-white/42 mt-3 text-xs font-semibold">
          {labels.trackRecord.sampleSizeSmall}
        </p>
      )}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
      <div className="text-[11px] font-bold text-white/40">{label}</div>
      <div className="mt-1 font-mono text-sm font-black text-white">{value}</div>
    </div>
  );
}

function dominantSource(winrate: TeamMemberWinrate): RecordSourceBadgeType {
  const entries = Object.entries(winrate.recordSourceMix).filter(([, count]) => count > 0);
  if (entries.length === 0) return "none";
  if (entries.length > 1) return "mixed";
  return entries[0]![0] as RecordSourceBadgeType;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number) {
  const rounded = value.toFixed(1);
  return `${value >= 0 ? "+" : ""}${rounded}%`;
}
