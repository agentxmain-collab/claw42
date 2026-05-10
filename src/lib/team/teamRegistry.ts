export type TeamMemberId =
  | "fundamental_analyst"
  | "news_analyst"
  | "chart_analyst"
  | "onchain_analyst"
  | "research_lead"
  | "risk_lead"
  | "pm";

export type TeamRoleId = "analyst" | "lead" | "pm";

export type TeamProviderId = "deepseek" | "minimax" | "claude-haiku" | "claude-opus";

export interface TeamMember {
  id: TeamMemberId;
  role: TeamRoleId;
  promptDocPath: string;
  defaultProvider: TeamProviderId;
  displayNameKey: string;
  roleTitleKey: string;
  avatarPath: string;
}

export const TEAM_MEMBER_REGISTRY: Record<TeamMemberId, TeamMember> = {
  fundamental_analyst: {
    id: "fundamental_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/fundamental_analyst.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.fundamental_analyst.displayName",
    roleTitleKey: "team.fundamental_analyst.roleTitle",
    avatarPath: "/images/team/fundamental_analyst.svg",
  },
  news_analyst: {
    id: "news_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/news_analyst.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.news_analyst.displayName",
    roleTitleKey: "team.news_analyst.roleTitle",
    avatarPath: "/images/team/news_analyst.svg",
  },
  chart_analyst: {
    id: "chart_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/chart_analyst.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.chart_analyst.displayName",
    roleTitleKey: "team.chart_analyst.roleTitle",
    avatarPath: "/images/team/chart_analyst.svg",
  },
  onchain_analyst: {
    id: "onchain_analyst",
    role: "analyst",
    promptDocPath: "docs/agent-ip/team/onchain_analyst.md",
    defaultProvider: "minimax",
    displayNameKey: "team.onchain_analyst.displayName",
    roleTitleKey: "team.onchain_analyst.roleTitle",
    avatarPath: "/images/team/onchain_analyst.svg",
  },
  research_lead: {
    id: "research_lead",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/research_lead.md",
    defaultProvider: "minimax",
    displayNameKey: "team.research_lead.displayName",
    roleTitleKey: "team.research_lead.roleTitle",
    avatarPath: "/images/team/research_lead.svg",
  },
  risk_lead: {
    id: "risk_lead",
    role: "lead",
    promptDocPath: "docs/agent-ip/team/risk_lead.md",
    defaultProvider: "deepseek",
    displayNameKey: "team.risk_lead.displayName",
    roleTitleKey: "team.risk_lead.roleTitle",
    avatarPath: "/images/team/risk_lead.svg",
  },
  pm: {
    id: "pm",
    role: "pm",
    promptDocPath: "docs/agent-ip/team/pm.md",
    // PM Opus is reserved for high-severity decisions; normal routing is defined in spec-2.
    defaultProvider: "claude-opus",
    displayNameKey: "team.pm.displayName",
    roleTitleKey: "team.pm.roleTitle",
    avatarPath: "/images/team/pm.svg",
  },
};

export const TEAM_MEMBER_IDS = Object.keys(TEAM_MEMBER_REGISTRY) as TeamMemberId[];

export function isTeamMemberId(value: string): value is TeamMemberId {
  return value in TEAM_MEMBER_REGISTRY;
}

export function getTeamMember(id: TeamMemberId): TeamMember {
  return TEAM_MEMBER_REGISTRY[id];
}
