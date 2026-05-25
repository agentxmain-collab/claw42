import type { DispatchAgentId } from "../v9/types";
import type {
  DispatchV10AgentRoleId,
  FlowStageVisual,
  HeroAgentRoleId,
  HeroAgentVisual,
} from "./types";

export const heroAgents: HeroAgentVisual[] = [
  {
    id: "news",
    className: "a-news",
    tier: "tier-c",
    readoutId: "NEWS·N",
    label: "News · N",
    hasSpeech: true,
    style: { left: "69%", top: "19%", tz: "-92px", bob: "2px", dur: "7.2s", delay: "0.2s" },
  },
  {
    id: "technical",
    className: "a-tech",
    tier: "tier-c",
    readoutId: "TECH·T",
    label: "Technical · T",
    hasSpeech: true,
    style: { left: "32%", top: "21%", tz: "-72px", bob: "3px", dur: "6.8s", delay: "1.8s" },
  },
  {
    id: "aggressive",
    className: "a-aggr",
    tier: "tier-c",
    readoutId: "AGGR·A",
    label: "Aggressive · A",
    hasSpeech: true,
    style: { left: "61%", top: "83%", tz: "-78px", bob: "3px", dur: "6.4s", delay: "1s" },
  },
  {
    id: "neutral",
    className: "a-neut",
    tier: "tier-c",
    readoutId: "NEUT·N",
    label: "Neutral · N",
    hasSpeech: true,
    style: { left: "8%", top: "28%", tz: "-90px", bob: "2px", dur: "7s", delay: "2s" },
  },
  {
    id: "fundamental",
    className: "a-fund",
    tier: "tier-b",
    readoutId: "FUND·F",
    label: "Fundamentals · F",
    hasSpeech: true,
    style: { left: "71%", top: "38%", tz: "0px", bob: "5px", dur: "6.2s", delay: "0.9s" },
  },
  {
    id: "onchain",
    className: "a-sent",
    tier: "tier-b",
    readoutId: "CHAIN·O",
    label: "On-chain · O",
    hasSpeech: true,
    style: { left: "88%", top: "51%", tz: "-15px", bob: "4px", dur: "5.4s", delay: "1.5s" },
  },
  {
    id: "conservative",
    className: "a-cons",
    tier: "tier-b",
    readoutId: "CONS·C",
    label: "Conservative · C",
    hasSpeech: true,
    style: { left: "17%", top: "73%", tz: "-20px", bob: "6px", dur: "6s", delay: "0.3s" },
  },
  {
    id: "portfolioManager",
    className: "a-pm",
    tier: "tier-b",
    readoutId: "PM·★",
    label: "Portfolio Manager · PM",
    hasSpeech: true,
    style: { left: "50%", top: "28%", tz: "20px", bob: "6px", dur: "5.8s", delay: "0.6s" },
  },
  {
    id: "bullish",
    className: "a-bull",
    tier: "tier-a",
    readoutId: "BULL·↑",
    label: "Bullish · ↑",
    hasSpeech: true,
    style: { left: "20%", top: "50%", tz: "72px", bob: "7px", dur: "5.4s", delay: "0s" },
  },
  {
    id: "bearish",
    className: "a-bear",
    tier: "tier-a",
    readoutId: "BEAR·↓",
    label: "Bearish · ↓",
    hasSpeech: true,
    style: { left: "69%", top: "62%", tz: "80px", bob: "8px", dur: "4.9s", delay: "1.2s" },
  },
  {
    id: "trader",
    className: "a-trade",
    tier: "tier-a",
    readoutId: "TRADE·$",
    label: "Trader · $",
    hasSpeech: true,
    style: { left: "42%", top: "71%", tz: "98px", bob: "9px", dur: "5.2s", delay: "0.4s" },
  },
];

export const flowStages: FlowStageVisual[] = [
  { num: 1, agentIds: ["fundamental", "onchain", "news", "technical"] },
  { num: 2, agentIds: ["bullish", "bearish"], variant: "debate" },
  { num: 3, agentIds: ["trader"] },
  { num: 4, agentIds: ["aggressive", "neutral", "conservative"], variant: "debate" },
  { num: 5, agentIds: ["portfolioManager"], variant: "final" },
  { num: 6, agentIds: ["memoryLoop"], variant: "memory" },
];

export const avatarClassByRole: Record<DispatchV10AgentRoleId, string> = {
  fundamental: "a-fund",
  onchain: "a-sent",
  news: "a-news",
  technical: "a-tech",
  bullish: "a-bull",
  bearish: "a-bear",
  trader: "a-trade",
  aggressive: "a-aggr",
  neutral: "a-neut",
  conservative: "a-cons",
  portfolioManager: "a-pm",
  memoryLoop: "a-mem",
};

export const avatarLabelByRole: Record<DispatchV10AgentRoleId, string> = {
  fundamental: "F",
  onchain: "O",
  news: "N",
  technical: "T",
  bullish: "↑",
  bearish: "↓",
  trader: "$",
  aggressive: "A",
  neutral: "N",
  conservative: "C",
  portfolioManager: "PM",
  memoryLoop: "∞",
};

const AVATAR_BASE_PATH = "/agent-watch/c-line-ui-uplift-v1/avatars";

export const avatarSrcByRole: Record<DispatchV10AgentRoleId, string> = {
  fundamental: `${AVATAR_BASE_PATH}/fundamental_analyst.svg`,
  onchain: `${AVATAR_BASE_PATH}/onchain_analyst.svg`,
  news: `${AVATAR_BASE_PATH}/news_analyst.svg`,
  technical: `${AVATAR_BASE_PATH}/chart_analyst.svg`,
  bullish: `${AVATAR_BASE_PATH}/bullish_researcher.svg`,
  bearish: `${AVATAR_BASE_PATH}/bearish_researcher.svg`,
  trader: `${AVATAR_BASE_PATH}/trader.svg`,
  aggressive: `${AVATAR_BASE_PATH}/aggressive_reviewer.svg`,
  neutral: `${AVATAR_BASE_PATH}/neutral_reviewer.svg`,
  conservative: `${AVATAR_BASE_PATH}/conservative_reviewer.svg`,
  portfolioManager: `${AVATAR_BASE_PATH}/pm-approve.svg`,
  memoryLoop: `${AVATAR_BASE_PATH}/memory_loop.svg`,
};

export const coreRobotAvatarSrc = `${AVATAR_BASE_PATH}/bot-base.svg`;

export const v9AgentToV10Role: Record<DispatchAgentId, DispatchV10AgentRoleId> = {
  fundamental_analyst: "fundamental",
  onchain_analyst: "onchain",
  news_analyst: "news",
  technical_analyst: "technical",
  bullish_researcher: "bullish",
  bearish_researcher: "bearish",
  trader: "trader",
  aggressive_reviewer: "aggressive",
  neutral_reviewer: "neutral",
  conservative_reviewer: "conservative",
  portfolio_manager: "portfolioManager",
  memory_loop: "memoryLoop",
};

export const heroAgentIds = heroAgents.map((agent) => agent.id) as HeroAgentRoleId[];
