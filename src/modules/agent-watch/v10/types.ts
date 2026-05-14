import type { DispatchConsoleV9Props, DispatchTopic } from "../v9/types";

export type DispatchConsoleV10Props = DispatchConsoleV9Props;

export type DispatchV10AgentRoleId =
  | "fundamental"
  | "onchain"
  | "news"
  | "technical"
  | "bullish"
  | "bearish"
  | "trader"
  | "aggressive"
  | "neutral"
  | "conservative"
  | "portfolioManager"
  | "memoryLoop";

export type HeroAgentRoleId = Exclude<DispatchV10AgentRoleId, "memoryLoop">;

export type FlowStageVariant = "debate" | "final" | "memory";

export interface HeroAgentVisual {
  id: HeroAgentRoleId;
  className: string;
  tier: "tier-a" | "tier-b" | "tier-c";
  readoutId: string;
  label: string;
  hasSpeech?: boolean;
  style: {
    left: string;
    top: string;
    tz: string;
    bob: string;
    dur: string;
    delay: string;
  };
}

export interface FlowStageVisual {
  num: 1 | 2 | 3 | 4 | 5 | 6;
  agentIds: DispatchV10AgentRoleId[];
  variant?: FlowStageVariant;
}

export interface DispatchV10TopicCardProps {
  topic: DispatchTopic;
  latest: boolean;
}
