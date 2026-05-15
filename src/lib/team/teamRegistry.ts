import { withBasePath } from "@/lib/basePath";

export type TeamMemberId =
  | "fundamental_analyst"
  | "news_analyst"
  | "chart_analyst"
  | "onchain_analyst"
  | "research_lead"
  | "risk_lead"
  | "pm"
  | "bullish_researcher"
  | "bearish_researcher"
  | "trader"
  | "aggressive_reviewer"
  | "neutral_reviewer"
  | "conservative_reviewer"
  | "memory_loop";

export type TeamRoleId = "analyst" | "lead" | "pm";

export type TeamProviderId = "deepseek" | "minimax" | "claude-haiku" | "claude-opus";

export interface TeamMember {
  id: TeamMemberId;
  role: TeamRoleId;
  promptDocPath: string;
  defaultProvider: TeamProviderId;
  displayNameKey: string;
  roleTitleKey: string;
  oneLineCapability: string;
  avatarPath: string;
}

export const TEAM_MEMBER_REGISTRY: Record<TeamMemberId, TeamMember> = {
  fundamental_analyst: {
    id: "fundamental_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/fundamental_analyst.md",
    defaultProvider: "minimax",
    displayNameKey: "team.fundamental_analyst.displayName",
    roleTitleKey: "team.fundamental_analyst.roleTitle",
    oneLineCapability: "team.fundamental_analyst.oneLineCapability",
    avatarPath: withBasePath("/images/team/fundamental_analyst.svg"),
  },
  news_analyst: {
    id: "news_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/news_analyst.md",
    defaultProvider: "minimax",
    displayNameKey: "team.news_analyst.displayName",
    roleTitleKey: "team.news_analyst.roleTitle",
    oneLineCapability: "team.news_analyst.oneLineCapability",
    avatarPath: withBasePath("/images/team/news_analyst.svg"),
  },
  chart_analyst: {
    id: "chart_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/chart_analyst.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.chart_analyst.displayName",
    roleTitleKey: "team.chart_analyst.roleTitle",
    oneLineCapability: "team.chart_analyst.oneLineCapability",
    avatarPath: withBasePath("/images/team/chart_analyst.svg"),
  },
  onchain_analyst: {
    id: "onchain_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/onchain_analyst.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.onchain_analyst.displayName",
    roleTitleKey: "team.onchain_analyst.roleTitle",
    oneLineCapability: "team.onchain_analyst.oneLineCapability",
    avatarPath: withBasePath("/images/team/onchain_analyst.svg"),
  },
  research_lead: {
    id: "research_lead",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/research_lead.md",
    defaultProvider: "minimax",
    displayNameKey: "team.research_lead.displayName",
    roleTitleKey: "team.research_lead.roleTitle",
    oneLineCapability: "team.research_lead.oneLineCapability",
    avatarPath: withBasePath("/images/team/research_lead.svg"),
  },
  risk_lead: {
    id: "risk_lead",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/risk_lead.md",
    defaultProvider: "minimax",
    displayNameKey: "team.risk_lead.displayName",
    roleTitleKey: "team.risk_lead.roleTitle",
    oneLineCapability: "team.risk_lead.oneLineCapability",
    avatarPath: withBasePath("/images/team/risk_lead.svg"),
  },
  pm: {
    id: "pm",
    role: "pm",
    promptDocPath: "docs/agent-ip/team/pm.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.pm.displayName",
    roleTitleKey: "team.pm.roleTitle",
    oneLineCapability: "team.pm.oneLineCapability",
    avatarPath: withBasePath("/images/team/pm.svg"),
  },
  bullish_researcher: {
    id: "bullish_researcher",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/bullish_researcher.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.bullish_researcher.displayName",
    roleTitleKey: "team.bullish_researcher.roleTitle",
    oneLineCapability: "team.bullish_researcher.oneLineCapability",
    avatarPath: withBasePath("/images/team/bullish_researcher.svg"),
  },
  bearish_researcher: {
    id: "bearish_researcher",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/bearish_researcher.md",
    defaultProvider: "minimax",
    displayNameKey: "team.bearish_researcher.displayName",
    roleTitleKey: "team.bearish_researcher.roleTitle",
    oneLineCapability: "team.bearish_researcher.oneLineCapability",
    avatarPath: withBasePath("/images/team/bearish_researcher.svg"),
  },
  trader: {
    id: "trader",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/trader.md",
    defaultProvider: "minimax",
    displayNameKey: "team.trader.displayName",
    roleTitleKey: "team.trader.roleTitle",
    oneLineCapability: "team.trader.oneLineCapability",
    avatarPath: withBasePath("/images/team/trader.svg"),
  },
  aggressive_reviewer: {
    id: "aggressive_reviewer",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/aggressive_reviewer.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.aggressive_reviewer.displayName",
    roleTitleKey: "team.aggressive_reviewer.roleTitle",
    oneLineCapability: "team.aggressive_reviewer.oneLineCapability",
    avatarPath: withBasePath("/images/team/aggressive_reviewer.svg"),
  },
  neutral_reviewer: {
    id: "neutral_reviewer",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/neutral_reviewer.md",
    defaultProvider: "minimax",
    displayNameKey: "team.neutral_reviewer.displayName",
    roleTitleKey: "team.neutral_reviewer.roleTitle",
    oneLineCapability: "team.neutral_reviewer.oneLineCapability",
    avatarPath: withBasePath("/images/team/neutral_reviewer.svg"),
  },
  conservative_reviewer: {
    id: "conservative_reviewer",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/conservative_reviewer.md",
    defaultProvider: "minimax",
    displayNameKey: "team.conservative_reviewer.displayName",
    roleTitleKey: "team.conservative_reviewer.roleTitle",
    oneLineCapability: "team.conservative_reviewer.oneLineCapability",
    avatarPath: withBasePath("/images/team/conservative_reviewer.svg"),
  },
  memory_loop: {
    id: "memory_loop",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/memory_loop.md",
    defaultProvider: "minimax",
    displayNameKey: "team.memory_loop.displayName",
    roleTitleKey: "team.memory_loop.roleTitle",
    oneLineCapability: "team.memory_loop.oneLineCapability",
    avatarPath: withBasePath("/images/team/memory_loop.svg"),
  },
};

export const TEAM_MEMBER_IDS = Object.keys(TEAM_MEMBER_REGISTRY) as TeamMemberId[];

export function isTeamMemberId(value: string): value is TeamMemberId {
  return value in TEAM_MEMBER_REGISTRY;
}

export function getTeamMember(id: TeamMemberId): TeamMember {
  return TEAM_MEMBER_REGISTRY[id];
}
