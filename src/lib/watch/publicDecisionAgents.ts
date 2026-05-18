import { isTeamMemberId, type TeamMemberId } from "@/lib/team/teamRegistry";

export type PublicDecisionAgentId =
  | "pa_01"
  | "pa_02"
  | "pa_03"
  | "pa_04"
  | "pa_05"
  | "pa_06"
  | "pa_07"
  | "pa_08"
  | "pa_09"
  | "pa_10"
  | "pa_11"
  | "pa_12"
  | "pa_13"
  | "pa_14";

const PUBLIC_AGENT_BY_MEMBER: Record<TeamMemberId, PublicDecisionAgentId> = {
  fundamental_analyst: "pa_01",
  news_analyst: "pa_02",
  chart_analyst: "pa_03",
  onchain_analyst: "pa_04",
  research_lead: "pa_05",
  risk_lead: "pa_06",
  pm: "pa_07",
  bullish_researcher: "pa_08",
  bearish_researcher: "pa_09",
  trader: "pa_10",
  aggressive_reviewer: "pa_11",
  neutral_reviewer: "pa_12",
  conservative_reviewer: "pa_13",
  memory_loop: "pa_14",
};

const MEMBER_BY_PUBLIC_AGENT = Object.fromEntries(
  Object.entries(PUBLIC_AGENT_BY_MEMBER).map(([memberId, agentId]) => [agentId, memberId]),
) as Record<PublicDecisionAgentId, TeamMemberId>;

export const PUBLIC_DECISION_AGENT_IDS = Object.values(PUBLIC_AGENT_BY_MEMBER);

export function mapTeamMemberToPublicDecisionAgent(memberId: TeamMemberId): PublicDecisionAgentId {
  return PUBLIC_AGENT_BY_MEMBER[memberId];
}

export function mapPublicDecisionAgentToTeamMember(agentId: PublicDecisionAgentId): TeamMemberId {
  return MEMBER_BY_PUBLIC_AGENT[agentId];
}

export function isPublicDecisionAgentId(value: string): value is PublicDecisionAgentId {
  return value in MEMBER_BY_PUBLIC_AGENT;
}

export function publicAgentForMaybeTeamMember(value: unknown): PublicDecisionAgentId | null {
  const memberId = String(value);
  return isTeamMemberId(memberId) ? mapTeamMemberToPublicDecisionAgent(memberId) : null;
}
