import type { AgentId, CoinSymbol, SignalSeverity } from "@/modules/agent-watch/types";

export type FactionId = AgentId;

export type NewsSourceMode = "mock" | "hybrid" | "live";
export type NewsSentiment = "bullish" | "bearish" | "neutral";
export type NewsSeverity = "low" | "medium" | "high" | "critical";
export type NewsDebateStatus = "queued" | "in_progress" | "completed" | "failed";
export type DebateDirection = "long" | "short" | "wait";
export type ConsensusRatio = "3:0" | "2:1" | "1:2" | "0:3";
export type DebateRoundNumber = 1 | 2 | 3;
export type DebateRoundType = "independent" | "rebuttal" | "consensus";
export type UtterancePrefix =
  | "rebut"
  | "taunt"
  | "sneer"
  | "mock"
  | "cool"
  | "remind"
  | "agree"
  | "reflect"
  | null;
export type AgentEmotion = "neutral" | "confident" | "angry" | "skeptical" | "excited";
export type DebateProjectionView = "public" | "operator" | "share";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain?: string;
  currencies: string[];
  sentiment: NewsSentiment;
  publishedAt: number;
  votes?: {
    positive: number;
    negative: number;
    important: number;
  };
}

export interface NewsTriggerClassification {
  severity: NewsSeverity;
  shouldAutoDebate: boolean;
  reason: string;
  dedupeKey: string;
  signalSeverity: SignalSeverity;
}

export interface DebateRound {
  roundNumber: DebateRoundNumber;
  roundType: DebateRoundType;
  utterances: Utterance[];
  startedAt: number;
}

export interface Utterance {
  id: string;
  agentId: FactionId;
  content: string;
  prefix: UtterancePrefix;
  emoji: string;
  emotion: AgentEmotion;
  citedAgentId?: FactionId;
  citedQuote?: string;
  isGoldenLine: boolean;
  ts: number;
}

export interface FinalStrategy {
  id: string;
  symbol: string;
  direction: DebateDirection;
  entryCondition: string;
  stopLoss: number;
  takeProfit: number[];
  consensusRatio: ConsensusRatio;
  consensusAgents: FactionId[];
  dissentAgents: FactionId[];
  dissentNote: string;
  riskNote: string;
  followCount: number;
  viewCount: number;
  createdAt: number;
  expiresAt: number;
  deeplink: string;
}

export interface NewsDebateLayers {
  source: NewsItem;
  trigger: NewsTriggerClassification;
  pacing: DebatePacingPlan;
  rounds: DebateRound[];
  strategy: FinalStrategy | null;
  replay: StrategyReplay | null;
}

export interface NewsDebate {
  id: string;
  ts: number;
  newsId: string;
  newsTitle: string;
  newsUrl: string;
  newsSource: string;
  newsSentiment: NewsSentiment;
  newsCurrencies: string[];
  rounds: DebateRound[];
  finalStrategy: FinalStrategy | null;
  intensityScore: 1 | 2 | 3 | 4 | 5;
  status: NewsDebateStatus;
  createdAt: number;
  completedAt: number | null;
  layers: NewsDebateLayers;
}

export interface DebatePacingPlan {
  roundOneDelayMs: number;
  roundTwoDelayMs: number;
  strategyRevealDelayMs: number;
  utteranceIntervalMs: number;
  typingLeadMs: number;
}

export interface StrategyReplay {
  strategyId: string;
  debateId: string;
  symbol: string;
  direction: DebateDirection;
  openedAt: number;
  evaluatedAt: number;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  isWin: boolean;
}

export interface AgentWinrate {
  agentId: FactionId;
  sampleSize: number;
  wins: number;
  losses: number;
  winrate: number;
}

export interface RivalryRecord {
  agentA: FactionId;
  agentB: FactionId;
  winsA: number;
  winsB: number;
  draws: number;
}

export interface PublicDebateProjection {
  id: string;
  ts: number;
  title: string;
  source: string;
  currencies: string[];
  severity: NewsSeverity;
  status: NewsDebateStatus;
  intensityScore: NewsDebate["intensityScore"];
  rounds: DebateRound[];
  finalStrategy: FinalStrategy | null;
}

export interface OperatorDebateProjection extends PublicDebateProjection {
  rawNews: NewsItem;
  trigger: NewsTriggerClassification;
  layers: NewsDebateLayers;
}

export interface ShareDebateProjection {
  id: string;
  title: string;
  source: string;
  symbol: string;
  direction: DebateDirection;
  consensusRatio: ConsensusRatio;
  goldenLines: Utterance[];
  followCount: number;
}

export type DebateProjection =
  | PublicDebateProjection
  | OperatorDebateProjection
  | ShareDebateProjection;

export function normalizeDebateSymbol(symbol: string): string {
  return symbol.replace(/^\$/, "").toUpperCase();
}

export function isCoreCoinSymbol(symbol: string): symbol is CoinSymbol {
  return ["BTC", "ETH", "SOL", "USDT"].includes(normalizeDebateSymbol(symbol));
}
