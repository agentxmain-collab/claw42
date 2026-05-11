"use client";

import React from "react";
import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TeamActivityStatusMap } from "@/lib/team/teamWorkflowTypes";
import { WorkflowConnectorSvg } from "./WorkflowConnectorSvg";
import { WorkflowNode } from "./WorkflowNode";

const ANALYST_ROW: TeamMemberId[] = [
  "fundamental_analyst",
  "news_analyst",
  "chart_analyst",
  "onchain_analyst",
];
const LEAD_ROW: TeamMemberId[] = ["research_lead", "risk_lead"];
const PM_ROW: TeamMemberId[] = ["pm"];

export function TeamWorkflowPanel({
  statuses = {},
  replayActiveMemberId = null,
}: {
  statuses?: TeamActivityStatusMap;
  replayActiveMemberId?: TeamMemberId | null;
}) {
  const { t } = useI18n();

  useEffect(() => {
    trackEvent("workflow_panel_view", {
      active_member_id: replayActiveMemberId ?? null,
    });
  }, [replayActiveMemberId]);

  return (
    <section
      aria-labelledby="team-workflow-panel-title"
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d0f]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.35)] md:p-6"
    >
      <WorkflowConnectorSvg />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200/70">
            Claw 42 Watch
          </p>
          <h2 id="team-workflow-panel-title" className="mt-2 text-2xl font-black text-white">
            {t.team.workflowPanel.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {t.team.workflowPanel.description}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5 space-y-4">
        <WorkflowStage members={ANALYST_ROW} statuses={statuses} activeId={replayActiveMemberId} />
        <WorkflowStage members={LEAD_ROW} statuses={statuses} activeId={replayActiveMemberId} />
        <WorkflowStage members={PM_ROW} statuses={statuses} activeId={replayActiveMemberId} />
      </div>
    </section>
  );
}

function WorkflowStage({
  members,
  statuses,
  activeId,
}: {
  members: TeamMemberId[];
  statuses: TeamActivityStatusMap;
  activeId: TeamMemberId | null;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {members.map((memberId) => (
        <WorkflowNode
          key={memberId}
          memberId={memberId}
          labels={t.team}
          snapshot={statuses[memberId]}
          isReplayActive={activeId === memberId}
        />
      ))}
    </div>
  );
}
