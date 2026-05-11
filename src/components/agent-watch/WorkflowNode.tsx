"use client";

import React from "react";
import Image from "next/image";
import type { Dict } from "@/i18n/types";
import { getTeamMember, type TeamMemberId } from "@/lib/team/teamRegistry";
import type { TeamActivitySnapshot, TeamActivityStatus } from "@/lib/team/teamWorkflowTypes";

type TeamLabels = Dict["team"];

const STATUS_CLASS: Record<TeamActivityStatus, string> = {
  analyzing: "border-emerald-300/35 bg-emerald-300/[0.10] text-emerald-100",
  waiting_data: "border-amber-300/30 bg-amber-300/[0.10] text-amber-100",
  completed_recently: "border-[#7650ff]/45 bg-[#7650ff]/15 text-violet-100",
  idle: "border-white/10 bg-white/[0.05] text-white/48",
};

const STATUS_DOT_CLASS: Record<TeamActivityStatus, string> = {
  analyzing: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.55)]",
  waiting_data: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.45)]",
  completed_recently: "bg-[#9f7cff] shadow-[0_0_14px_rgba(118,80,255,0.55)]",
  idle: "bg-white/30",
};

export function WorkflowNode({
  memberId,
  labels,
  snapshot,
  isReplayActive = false,
}: {
  memberId: TeamMemberId;
  labels: TeamLabels;
  snapshot?: TeamActivitySnapshot;
  isReplayActive?: boolean;
}) {
  const member = getTeamMember(memberId);
  const memberLabels = labels[memberId];
  const status = isReplayActive ? "analyzing" : (snapshot?.status ?? "idle");
  const statusLabel = statusText(status, labels);

  return (
    <div
      className={[
        "relative min-h-[148px] rounded-2xl border bg-[#101012]/92 p-3 shadow-[0_18px_70px_rgba(0,0,0,0.28)] transition duration-300",
        isReplayActive ? "border-[#7650ff]/70 ring-1 ring-[#7650ff]/55" : "border-white/10",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <Image
            src={member.avatarPath}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-black text-white">{memberLabels.displayName}</h3>
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[status]}`} />
          </div>
          <p className="mt-1 text-[11px] font-bold text-violet-100/75">
            {memberLabels.roleTitle}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[36px] text-xs leading-relaxed text-white/52">
        {memberLabels.oneLineCapability}
      </p>

      <div
        className={`mt-3 inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold ${STATUS_CLASS[status]}`}
      >
        {statusLabel}
      </div>
    </div>
  );
}

function statusText(status: TeamActivityStatus, labels: TeamLabels) {
  if (status === "analyzing") return labels.workflowNode.statusAnalyzing;
  if (status === "waiting_data") return labels.workflowNode.statusWaitingData;
  if (status === "completed_recently") return labels.workflowNode.statusCompletedRecently;
  return labels.workflowNode.statusIdle;
}
