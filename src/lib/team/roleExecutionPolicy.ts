import { evidenceIdsForMember, type EvidenceContextPack } from "@/lib/team/evidenceDispatcher";
import { TEAM_MEMBER_IDS, type TeamMemberId } from "@/lib/team/teamRegistry";
import type { RoleExecutionMode, RoleExecutionTraceEntry } from "@/lib/team/strategyDecisionRecord";

export interface RoleResponsibilityContract {
  memberId: TeamMemberId;
  uniqueQuestion: string;
  privateInputScope: string;
  publicOutputShape: string;
  activationTrigger: string;
  mayBlockDecision: boolean;
  fallbackPublicBehavior: string;
}

export const TEAM_ROLE_EXECUTION_CONTRACTS: Record<TeamMemberId, RoleResponsibilityContract> = {
  fundamental_analyst: {
    memberId: "fundamental_analyst",
    uniqueQuestion: "What tokenomics, liquidity, or protocol facts change the tradeable thesis?",
    privateInputScope: "fundamental and broad market evidence only",
    publicOutputShape:
      "A short fundamental lens on whether non-price evidence strengthens the setup.",
    activationTrigger:
      "Fundamental evidence exists for the candidate or market-wide context is relevant.",
    mayBlockDecision: false,
    fallbackPublicBehavior:
      "Use shared market context as a neutral lens without exposing source coverage.",
  },
  news_analyst: {
    memberId: "news_analyst",
    uniqueQuestion: "Which verified event or narrative actually changes the market read?",
    privateInputScope: "news, source quality, timing, and broad market evidence only",
    publicOutputShape: "A short event lens that names the market impact, not backend data state.",
    activationTrigger: "Fresh candidate-specific or market-moving news evidence exists.",
    mayBlockDecision: false,
    fallbackPublicBehavior: "Stay silent or use PM synthesis as a neutral event lens.",
  },
  chart_analyst: {
    memberId: "chart_analyst",
    uniqueQuestion: "Which price structure or invalidation level proves this setup wrong?",
    privateInputScope: "chart, kline, momentum, volatility, volume, and broad market evidence",
    publicOutputShape:
      "A concise technical lens with structure, level, and invalidation when available.",
    activationTrigger: "Chart or market-signal evidence exists for the candidate.",
    mayBlockDecision: false,
    fallbackPublicBehavior:
      "Use shared market context as neutral structure without claiming a pattern.",
  },
  onchain_analyst: {
    memberId: "onchain_analyst",
    uniqueQuestion: "Does protocol or wallet activity confirm or reject the visible market move?",
    privateInputScope: "onchain, protocol, and broad market evidence only",
    publicOutputShape: "A short flow/activity lens only when it has a real market implication.",
    activationTrigger: "Onchain or protocol evidence exists for the candidate.",
    mayBlockDecision: false,
    fallbackPublicBehavior: "Stay as a neutral visible lens without public source-state language.",
  },
  research_lead: {
    memberId: "research_lead",
    uniqueQuestion: "Which evidence domain deserves the highest weight in PM synthesis?",
    privateInputScope: "active analyst outputs and shared evidence state",
    publicOutputShape: "A synthesis note explaining the strongest decision driver.",
    activationTrigger: "Always active after analyst inputs are available.",
    mayBlockDecision: false,
    fallbackPublicBehavior:
      "Use the strongest public-safe evidence already produced by active roles.",
  },
  risk_lead: {
    memberId: "risk_lead",
    uniqueQuestion: "What risk, invalidation, or evidence weakness should downgrade action?",
    privateInputScope: "active analyst outputs, risk evidence, stale signals, and execution safety",
    publicOutputShape: "A risk boundary or downgrade note in market-facing language.",
    activationTrigger: "Always active as the risk review layer.",
    mayBlockDecision: true,
    fallbackPublicBehavior:
      "Express caution through PM synthesis without exposing backend conditions.",
  },
  pm: {
    memberId: "pm",
    uniqueQuestion: "What final stance should the user see after weighing evidence and risk?",
    privateInputScope:
      "all active role outputs, risk notes, execution constraints, and trade card state",
    publicOutputShape: "The final decision or watch-only interpretation with clear uncertainty.",
    activationTrigger: "Always active as final decision owner.",
    mayBlockDecision: true,
    fallbackPublicBehavior:
      "Publish only a public-safe analysis summary when execution is not appropriate.",
  },
  bullish_researcher: {
    memberId: "bullish_researcher",
    uniqueQuestion: "What is the strongest honest pro-action interpretation of the evidence?",
    privateInputScope: "confirmed chart, news, onchain, fundamental, and market evidence",
    publicOutputShape: "A concise pro-action thesis with explicit conviction.",
    activationTrigger: "At least one positive signal exists in the shared evidence state.",
    mayBlockDecision: false,
    fallbackPublicBehavior:
      "Project a light optimistic lens from PM synthesis without inventing evidence.",
  },
  bearish_researcher: {
    memberId: "bearish_researcher",
    uniqueQuestion: "What is the strongest honest anti-action or short-side interpretation?",
    privateInputScope: "confirmed chart, news, onchain, fundamental, and market evidence",
    publicOutputShape: "A concise defensive or anti-action thesis with explicit conviction.",
    activationTrigger:
      "At least one negative or invalidating signal exists in the shared evidence state.",
    mayBlockDecision: false,
    fallbackPublicBehavior:
      "Project a defensive lens from PM synthesis without inventing evidence.",
  },
  trader: {
    memberId: "trader",
    uniqueQuestion: "Is this candidate executable, and what makes the entry unsafe or acceptable?",
    privateInputScope: "chart, market, executable metadata, liquidity, and trade card constraints",
    publicOutputShape:
      "Execution feasibility and boundary language only for executable symbol candidates.",
    activationTrigger: "Candidate is an executable symbol with chart or market evidence.",
    mayBlockDecision: true,
    fallbackPublicBehavior:
      "For watch-only candidates, surface no trade affordance and no execution claim.",
  },
  aggressive_reviewer: {
    memberId: "aggressive_reviewer",
    uniqueQuestion: "Does the signal justify moving faster than a conservative baseline?",
    privateInputScope: "chart, news, market, and risk-adjusted momentum evidence",
    publicOutputShape: "A short speed/risk lens that names the condition for acting.",
    activationTrigger: "Momentum or event evidence is strong enough to test aggressive action.",
    mayBlockDecision: false,
    fallbackPublicBehavior: "Use a restrained role-lens projection without creating urgency.",
  },
  neutral_reviewer: {
    memberId: "neutral_reviewer",
    uniqueQuestion: "Is the balanced answer to do nothing despite visible market noise?",
    privateInputScope: "all shared public-safe evidence domains",
    publicOutputShape: "A balanced lens explaining why evidence does or does not clear the bar.",
    activationTrigger: "Evidence is mixed, sparse, or contradictory across domains.",
    mayBlockDecision: false,
    fallbackPublicBehavior: "Project balanced caution from PM synthesis.",
  },
  conservative_reviewer: {
    memberId: "conservative_reviewer",
    uniqueQuestion: "What minimum evidence is still required before accepting risk?",
    privateInputScope: "chart, onchain, fundamental, market, and downside evidence",
    publicOutputShape: "A concise conservative filter or risk threshold.",
    activationTrigger: "Risk evidence, stale context, or thin confirmation should be tested.",
    mayBlockDecision: false,
    fallbackPublicBehavior: "Project a conservative lens in market-facing language.",
  },
  memory_loop: {
    memberId: "memory_loop",
    uniqueQuestion: "Which resolved historical setups are similar enough to change confidence?",
    privateInputScope: "resolved decision history and sample-size caution only",
    publicOutputShape:
      "A compact historical analogy or sample caution when resolved history exists.",
    activationTrigger: "Resolved historical memory exists for a comparable setup.",
    mayBlockDecision: false,
    fallbackPublicBehavior: "Stay silent or defer to PM without public memory claims.",
  },
};

export interface BuildRoleExecutionTraceInput {
  evidencePack: EvidenceContextPack;
  activeInputMemberIds: readonly TeamMemberId[];
  executedInputMemberIds: readonly TeamMemberId[];
  abstainedInputMemberIds: readonly TeamMemberId[];
  materialContributorIds: readonly TeamMemberId[];
  warningMemberIds?: readonly TeamMemberId[];
  pmEvidenceIds?: readonly string[];
  leadEvidenceIds?: readonly string[];
}

const CORE_MEMBER_IDS = new Set<TeamMemberId>(["research_lead", "risk_lead", "pm"]);

function executionModeFor({
  memberId,
  activeInputMemberIds,
  executedInputMemberIds,
  abstainedInputMemberIds,
}: {
  memberId: TeamMemberId;
  activeInputMemberIds: Set<TeamMemberId>;
  executedInputMemberIds: Set<TeamMemberId>;
  abstainedInputMemberIds: Set<TeamMemberId>;
}): RoleExecutionMode {
  if (CORE_MEMBER_IDS.has(memberId)) return "core_active";
  if (activeInputMemberIds.has(memberId) && abstainedInputMemberIds.has(memberId)) {
    return "skipped_by_policy";
  }
  if (executedInputMemberIds.has(memberId)) return "conditional_active";
  if (activeInputMemberIds.has(memberId)) return "silent_evaluator";
  return "derived_visible";
}

function activationReasonFor(
  memberId: TeamMemberId,
  executionMode: RoleExecutionMode,
  evidenceIdsUsed: readonly string[],
) {
  const contract = TEAM_ROLE_EXECUTION_CONTRACTS[memberId];
  if (executionMode === "core_active") return contract.activationTrigger;
  if (executionMode === "conditional_active") {
    return `${contract.activationTrigger} Evidence ids: ${evidenceIdsUsed.join(", ") || "none"}.`;
  }
  if (executionMode === "silent_evaluator") {
    return "Role was activated for internal checks but did not produce public speech.";
  }
  if (executionMode === "skipped_by_policy") {
    return "Role was selected but abstained or failed public-output guardrails.";
  }
  return contract.fallbackPublicBehavior;
}

function evidenceForMember(
  memberId: TeamMemberId,
  evidencePack: EvidenceContextPack,
  pmEvidenceIds: readonly string[],
  leadEvidenceIds: readonly string[],
) {
  if (memberId === "pm") return Array.from(new Set(pmEvidenceIds));
  if (memberId === "research_lead" || memberId === "risk_lead") {
    return Array.from(new Set(leadEvidenceIds));
  }
  return evidenceIdsForMember(memberId, evidencePack);
}

export function buildRoleExecutionTrace({
  evidencePack,
  activeInputMemberIds,
  executedInputMemberIds,
  abstainedInputMemberIds,
  materialContributorIds,
  warningMemberIds = [],
  pmEvidenceIds = [],
  leadEvidenceIds = [],
}: BuildRoleExecutionTraceInput): RoleExecutionTraceEntry[] {
  const active = new Set(activeInputMemberIds);
  const executed = new Set(executedInputMemberIds);
  const abstained = new Set(abstainedInputMemberIds);
  const contributors = new Set(materialContributorIds);
  const warning = new Set(warningMemberIds);

  return TEAM_MEMBER_IDS.map((memberId) => {
    const evidenceIdsUsed = evidenceForMember(
      memberId,
      evidencePack,
      pmEvidenceIds,
      leadEvidenceIds,
    );
    const executionMode = executionModeFor({
      memberId,
      activeInputMemberIds: active,
      executedInputMemberIds: executed,
      abstainedInputMemberIds: abstained,
    });
    return {
      memberId,
      executionMode,
      activationReason: activationReasonFor(memberId, executionMode, evidenceIdsUsed),
      evidenceIdsUsed,
      contributedToPmDecision: contributors.has(memberId),
      vetoOrWarning: warning.has(memberId),
    };
  });
}
