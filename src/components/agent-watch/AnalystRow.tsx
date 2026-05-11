"use client";

import React from "react";
import Image from "next/image";
import { useI18n } from "@/i18n/I18nProvider";
import { getTeamMember, type TeamMemberId } from "@/lib/team/teamRegistry";
import { CitationChip } from "./CitationChip";

export interface AnalystRowProps {
  memberId: TeamMemberId;
  rationale: string | undefined;
  evidenceIds: string[];
  emphasis?: "analyst" | "lead" | "risk";
}

const EMPHASIS_CLASS = {
  analyst: "border-white/10 bg-white/[0.025]",
  lead: "border-[#7650ff]/35 bg-[#7650ff]/[0.07]",
  risk: "border-amber-300/25 bg-amber-300/[0.06]",
};

export function AnalystRow({
  memberId,
  rationale,
  evidenceIds,
  emphasis = "analyst",
}: AnalystRowProps) {
  const { t } = useI18n();
  const member = getTeamMember(memberId);
  const memberLabels = t.team[memberId];
  const hasRationale = Boolean(rationale?.trim());

  return (
    <div className={`rounded-2xl border p-3 ${EMPHASIS_CLASS[emphasis]}`}>
      <div className="flex gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          <Image
            src={member.avatarPath}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-black text-white">{memberLabels.displayName}</div>
            <div className="text-[11px] font-bold text-violet-100/60">
              {memberLabels.roleTitle}
            </div>
          </div>
          <p
            className={[
              "mt-2 text-sm leading-relaxed",
              hasRationale ? "text-white/72" : "text-white/38",
            ].join(" ")}
          >
            {hasRationale ? rationale : t.agentWatch.timeline.processToggle.waitingMember}
          </p>
          {evidenceIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceIds.map((evidenceId, index) => (
                <CitationChip key={evidenceId} evidenceId={evidenceId} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
