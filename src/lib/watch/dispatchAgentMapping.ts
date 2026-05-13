import type { Locale } from "@/i18n/types";
import { getTeamDisplayName } from "@/lib/team/teamDisplayNames";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { DispatchAgentId } from "@/modules/agent-watch/v9/types";

type DirectionHint = TradeDecision["direction"] | "neutral" | undefined;

export const DISPATCH_AGENT_NOT_IN_CURRENT: readonly DispatchAgentId[] = [
  "bullish_researcher",
  "bearish_researcher",
  "trader",
  "aggressive_reviewer",
  "neutral_reviewer",
  "conservative_reviewer",
  "memory_loop",
] as const;

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
  }
}

const ZH_SYNTHETIC_DISPLAY_NAMES: Partial<Record<DispatchAgentId, string>> = {
  technical_analyst: "技术分析师",
  bullish_researcher: "看多研究员",
  bearish_researcher: "看空研究员",
  trader: "交易员",
  aggressive_reviewer: "激进派",
  neutral_reviewer: "中立派",
  conservative_reviewer: "保守派",
  portfolio_manager: "PM",
  memory_loop: "记忆回路",
};

const EN_SYNTHETIC_DISPLAY_NAMES: Partial<Record<DispatchAgentId, string>> = {
  technical_analyst: "Technical Analyst",
  bullish_researcher: "Bullish Researcher",
  bearish_researcher: "Bearish Researcher",
  trader: "Trader",
  aggressive_reviewer: "Aggressive Reviewer",
  neutral_reviewer: "Neutral Reviewer",
  conservative_reviewer: "Conservative Reviewer",
  portfolio_manager: "PM",
  memory_loop: "Memory Loop",
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

  const names = isChineseLocale(locale) ? ZH_SYNTHETIC_DISPLAY_NAMES : EN_SYNTHETIC_DISPLAY_NAMES;
  return names[agentId] ?? EN_SYNTHETIC_DISPLAY_NAMES[agentId] ?? agentId;
}
