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
  technical_analyst: "技术策略主管",
  bullish_researcher: "多头策略师",
  bearish_researcher: "空头策略师",
  trader: "交易策略总监",
  aggressive_reviewer: "收益进攻官",
  neutral_reviewer: "组合平衡官",
  conservative_reviewer: "风险防御官",
  portfolio_manager: "首席投资官",
  memory_loop: "策略复盘主管",
};

const EN_SYNTHETIC_DISPLAY_NAMES: Partial<Record<DispatchAgentId, string>> = {
  technical_analyst: "Technical Strategy Lead",
  bullish_researcher: "Bullish Strategist",
  bearish_researcher: "Bearish Strategist",
  trader: "Trading Strategy Director",
  aggressive_reviewer: "Return Offensive Officer",
  neutral_reviewer: "Portfolio Balance Officer",
  conservative_reviewer: "Risk Defense Officer",
  portfolio_manager: "Chief Investment Officer",
  memory_loop: "Strategy Review Lead",
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
