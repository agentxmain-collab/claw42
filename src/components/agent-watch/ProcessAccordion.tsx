"use client";

import React from "react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { trackEvent } from "@/lib/analytics";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { PublicTimelinePayload } from "@/lib/watch/publicTimelineEvent";
import { AnalystRow } from "./AnalystRow";
import { LeadRow } from "./LeadRow";
import { RiskRow } from "./RiskRow";

type PmDecisionPayload = Extract<PublicTimelinePayload, { kind: "pm_decision" }>;
type ProcessSectionId = "analysts" | "leads";

const ANALYST_IDS: TeamMemberId[] = [
  "fundamental_analyst",
  "news_analyst",
  "chart_analyst",
  "onchain_analyst",
];

const LEAD_IDS: TeamMemberId[] = ["research_lead", "risk_lead"];

export function ProcessAccordion({
  payload,
  onReplayTrigger,
}: {
  payload: PmDecisionPayload;
  onReplayTrigger?: (recordId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <ProcessSection
        recordId={payload.recordId}
        section="analysts"
        title={t.agentWatch.timeline.processToggle.analysts}
        onReplayTrigger={onReplayTrigger}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {ANALYST_IDS.map((memberId) => (
            <AnalystRow
              key={memberId}
              memberId={memberId}
              rationale={payload.rationaleByMember[memberId]}
              evidenceIds={payload.citationsByMember?.[memberId] ?? []}
            />
          ))}
        </div>
      </ProcessSection>

      <ProcessSection
        recordId={payload.recordId}
        section="leads"
        title={t.agentWatch.timeline.processToggle.leads}
        onReplayTrigger={onReplayTrigger}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {LEAD_IDS.map((memberId) =>
            memberId === "risk_lead" ? (
              <RiskRow
                key={memberId}
                memberId={memberId}
                rationale={payload.rationaleByMember[memberId]}
                evidenceIds={payload.citationsByMember?.[memberId] ?? []}
              />
            ) : (
              <LeadRow
                key={memberId}
                memberId={memberId}
                rationale={payload.rationaleByMember[memberId]}
                evidenceIds={payload.citationsByMember?.[memberId] ?? []}
              />
            ),
          )}
        </div>
      </ProcessSection>
    </div>
  );
}

function ProcessSection({
  recordId,
  section,
  title,
  children,
  onReplayTrigger,
}: {
  recordId: string;
  section: ProcessSectionId;
  title: string;
  children: ReactNode;
  onReplayTrigger?: (recordId: string) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    trackEvent(next ? "process_accordion_expand" : "process_accordion_collapse", {
      record_id: recordId,
      section,
    });
    if (next) onReplayTrigger?.(recordId);
  };

  return (
    <div className="border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left"
        aria-expanded={expanded}
      >
        <span className="text-sm font-black text-white">{title}</span>
        <span className="text-xs font-bold text-violet-100/65">
          {expanded
            ? t.agentWatch.timeline.processToggle.collapse
            : t.agentWatch.timeline.processToggle.expand}
        </span>
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}
