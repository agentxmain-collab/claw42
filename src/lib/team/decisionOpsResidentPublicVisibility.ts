import { normalizeCandidateType, type CandidateType } from "@/lib/watch/decisionCandidate";
import type { PublicTimelineEvent, PublicTimelinePayload } from "@/lib/watch/publicTimelineEvent";

export type DecisionOpsResidentPublicVisibilityStatus = "ready" | "critical";
export type DecisionOpsResidentPublicVisibilityRequiredType = Extract<
  CandidateType,
  "market_overview" | "hotspot"
>;

export interface DecisionOpsResidentPublicVisibilityAction {
  title: string;
  description: string;
  executable: false;
}

export interface DecisionOpsResidentPublicVisibilityReport {
  schemaVersion: 1;
  generatedAt: string;
  status: DecisionOpsResidentPublicVisibilityStatus;
  allResidentCardsVisible: boolean;
  counts: {
    marketOverview: number;
    hotspot: number;
    symbol: number;
  };
  missingResidentTypes: DecisionOpsResidentPublicVisibilityRequiredType[];
  visibleResidentEventIds: {
    marketOverview: string[];
    hotspot: string[];
  };
  blockingReasons: string[];
  actions: DecisionOpsResidentPublicVisibilityAction[];
}

type PublicPmDecisionEvent = PublicTimelineEvent & {
  payload: Extract<PublicTimelinePayload, { kind: "pm_decision" }>;
};

const residentTypes: DecisionOpsResidentPublicVisibilityRequiredType[] = [
  "market_overview",
  "hotspot",
];

export function buildDecisionOpsResidentPublicVisibility({
  publicEvents,
  now = Date.now(),
}: {
  publicEvents: readonly PublicTimelineEvent[];
  now?: number;
}): DecisionOpsResidentPublicVisibilityReport {
  const byType = countByType(publicEvents.filter(isPublicPmEvent));
  const missingResidentTypes = residentTypes.filter((type) => byType[type].length === 0);
  const blockingReasons = missingResidentTypes.map(blockingReasonFor);
  const ready = missingResidentTypes.length === 0;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    status: ready ? "ready" : "critical",
    allResidentCardsVisible: ready,
    counts: {
      marketOverview: byType.market_overview.length,
      hotspot: byType.hotspot.length,
      symbol: byType.symbol.length,
    },
    missingResidentTypes,
    visibleResidentEventIds: {
      marketOverview: byType.market_overview.map((event) => event.id),
      hotspot: byType.hotspot.map((event) => event.id),
    },
    blockingReasons,
    actions: actionsFor(blockingReasons),
  };
}

function isPublicPmEvent(event: PublicTimelineEvent): event is PublicPmDecisionEvent {
  return event.payload.kind === "pm_decision";
}

function countByType(events: readonly PublicPmDecisionEvent[]) {
  const byType: Record<CandidateType, PublicPmDecisionEvent[]> = {
    market_overview: [],
    hotspot: [],
    symbol: [],
  };
  for (const event of events) {
    byType[normalizeCandidateType(event.payload.candidateType)].push(event);
  }
  return byType;
}

function blockingReasonFor(type: DecisionOpsResidentPublicVisibilityRequiredType) {
  return type === "market_overview"
    ? "resident_market_overview_not_visible"
    : "resident_hotspot_not_visible";
}

function actionsFor(
  blockingReasons: readonly string[],
): DecisionOpsResidentPublicVisibilityAction[] {
  if (blockingReasons.length === 0) return [];
  return [
    {
      title: "Inspect resident public projection",
      description:
        "Resident market overview and hotspot records must both be visible in the public PM card set before runtime behavior changes proceed.",
      executable: false,
    },
  ];
}
