import type { TeamMemberId } from "@/lib/team/teamRegistry";
import { mapPublicDecisionAgentToTeamMember } from "@/lib/watch/publicDecisionAgents";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export type PmDecisionTimelineEvent = PublicTimelineEvent & {
  payload: Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>;
};

function memberForRoundEntry(
  entry: NonNullable<PmDecisionTimelineEvent["payload"]["rounds"]>[number],
) {
  if (entry.memberId) return entry.memberId;
  if (entry.agentId) return mapPublicDecisionAgentToTeamMember(entry.agentId);
  return null;
}

function stageForMember(memberId: TeamMemberId) {
  if (
    memberId === "fundamental_analyst" ||
    memberId === "news_analyst" ||
    memberId === "chart_analyst" ||
    memberId === "onchain_analyst"
  ) {
    return 1;
  }
  if (memberId === "research_lead") return 2;
  if (memberId === "bullish_researcher" || memberId === "bearish_researcher") return 2;
  if (memberId === "trader") return 3;
  if (memberId === "risk_lead") return 4;
  if (
    memberId === "aggressive_reviewer" ||
    memberId === "neutral_reviewer" ||
    memberId === "conservative_reviewer"
  ) {
    return 4;
  }
  if (memberId === "memory_loop") return 6;
  return 5;
}

export function hasPublicInformationCollectionRound(event: PmDecisionTimelineEvent) {
  const roundEntries = Array.isArray(event.payload.rounds) ? event.payload.rounds : [];
  if (roundEntries.length === 0) return true;
  return roundEntries.some((entry) => {
    const memberId = memberForRoundEntry(entry);
    return (
      Boolean(memberId) &&
      memberId !== null &&
      stageForMember(memberId) === 1 &&
      entry.round <= 1 &&
      entry.rationale.trim().length > 0
    );
  });
}

export function isPublicDisplayablePmDecisionEvent(
  event: PublicTimelineEvent,
): event is PmDecisionTimelineEvent {
  if (event.payload.kind !== "pm_decision") return false;
  return hasPublicInformationCollectionRound(event as PmDecisionTimelineEvent);
}
