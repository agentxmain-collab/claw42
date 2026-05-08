export type HeroStrategyDirection = "long" | "short" | "watch";

export interface AgentMessage {
  agentName: string;
  role: string;
  message: string;
}

export interface StrategyCard {
  direction: HeroStrategyDirection;
  confidence: number;
  entry: string;
  stopLoss: string;
  target: string;
  note: string;
}

export interface HeroMiniPlayerData {
  symbol: string;
  displayName: string;
  priceLine: string;
  agentMessages: AgentMessage[];
  strategyCard: StrategyCard;
}
