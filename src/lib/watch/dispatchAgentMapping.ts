import type { Locale } from "@/i18n/types";
import { getTeamDisplayName } from "@/lib/team/teamDisplayNames";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { DispatchAgentId } from "@/modules/agent-watch/v9/types";

type DirectionHint = TradeDecision["direction"] | "neutral" | undefined;

export const DISPATCH_AGENT_NOT_IN_CURRENT: readonly DispatchAgentId[] = [] as const;

export function mapTeamMemberToDispatchAgent(
  memberId: TeamMemberId,
  directionHint?: DirectionHint,
): DispatchAgentId {
  switch (memberId) {
    case "fundamental_analyst":
    case "news_analyst":
    case "onchain_analyst":
      return memberId;
    case "chart_analyst":
      return "technical_analyst";
    case "research_lead":
      return directionHint === "short" ? "bearish_researcher" : "bullish_researcher";
    case "risk_lead":
      return directionHint === "long" ? "aggressive_reviewer" : "neutral_reviewer";
    case "pm":
      return "portfolio_manager";
    case "bullish_researcher":
    case "bearish_researcher":
    case "trader":
    case "aggressive_reviewer":
    case "neutral_reviewer":
    case "conservative_reviewer":
    case "memory_loop":
      return memberId;
  }
}

const ZH_SYNTHETIC_DISPLAY_NAMES: Partial<Record<DispatchAgentId, string>> = {
  technical_analyst: "技术策略主管",
  portfolio_manager: "首席投资官",
};

const EN_SYNTHETIC_DISPLAY_NAMES: Partial<Record<DispatchAgentId, string>> = {
  technical_analyst: "Technical Strategy Lead",
  portfolio_manager: "Chief Investment Officer",
};

function isChineseLocale(locale: Locale) {
  return locale === "zh_CN" || locale === "zh_TW";
}

export function getDispatchAgentDisplayName(
  agentId: DispatchAgentId,
  locale: Locale,
  sourceMemberId?: TeamMemberId,
) {
  if (sourceMemberId) return getTeamDisplayName(sourceMemberId, locale);
  if (agentId === "fundamental_analyst") return getTeamDisplayName(agentId, locale);
  if (agentId === "news_analyst") return getTeamDisplayName(agentId, locale);
  if (agentId === "onchain_analyst") return getTeamDisplayName(agentId, locale);
  if (agentId === "technical_analyst") return getTeamDisplayName("chart_analyst", locale);
  if (agentId === "bullish_researcher") return getTeamDisplayName(agentId, locale);
  if (agentId === "bearish_researcher") return getTeamDisplayName(agentId, locale);
  if (agentId === "trader") return getTeamDisplayName(agentId, locale);
  if (agentId === "aggressive_reviewer") return getTeamDisplayName(agentId, locale);
  if (agentId === "neutral_reviewer") return getTeamDisplayName(agentId, locale);
  if (agentId === "conservative_reviewer") return getTeamDisplayName(agentId, locale);
  if (agentId === "memory_loop") return getTeamDisplayName(agentId, locale);

  const names = isChineseLocale(locale) ? ZH_SYNTHETIC_DISPLAY_NAMES : EN_SYNTHETIC_DISPLAY_NAMES;
  return names[agentId] ?? EN_SYNTHETIC_DISPLAY_NAMES[agentId] ?? agentId;
}
