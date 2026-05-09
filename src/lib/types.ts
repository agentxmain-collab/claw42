import type { AgentId, CoinSymbol, SignalSeverity } from "@/modules/agent-watch/types";
import type { Rating5Tier } from "@/lib/rating";

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
export type ConversationSeedType = "news" | "market" | "chitchat";
export type TriggerReason =
  | "cooldown_expired"
  | "breaking_news"
  | "price_volatility"
  | "dev_override"
  | "cold_start";
export type ChatAction =
  | "open"
  | "rebut"
  | "agree"
  | "question"
  | "taunt"
  | "derail"
  | "refocus"
  | "comment"
  | "react"
  | "concede"
  | "gloat";
export type ChatMood = "aggressive" | "agreeable" | "neutral" | "sarcastic" | "curious";

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
  marketDataFetchedAt?: number;
}

export interface ConversationSeed {
  id: string;
  type: ConversationSeedType;
  title: string;
  description: string;
  symbols: string[];
  sentiment: NewsSentiment;
  source?: string;
  url?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  ts: number;
  agentId: FactionId;
  content: string;
  contentEn?: string;
  contentZh?: string;
  replyTo?: string;
  mentioning?: FactionId;
  action: ChatAction;
  expectsReply: boolean;
  mood: ChatMood;
  citedQuote?: string;
  isGoldenLine?: boolean;
  marketDataFetchedAt?: number;
  dataSource: "coinw" | "coingecko" | "fallback";
  snapshotAt: number;
  fetchedAt: number;
  failureFallback: boolean;
}

export interface ChatThread {
  id: string;
  seed: ConversationSeed;
  messages: ChatMessage[];
  strategy: FinalStrategy | null;
  status: "active" | "completing" | "completed" | "cooldown" | "archived" | "degraded";
  createdAt: number;
  completedAt?: number;
  cooldownUntil?: number | null;
  symbol?: string;
  llmCallsUsed?: number;
  retryCount?: number;
}

export interface FinalStrategy {
  id: string;
  symbol: string;
  direction: DebateDirection;
  rating: Rating5Tier;
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
  chatThread: ChatThread;
  messages: ChatMessage[];
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
  chatThread: ChatThread;
  messages: ChatMessage[];
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
  chatThread: ChatThread;
  messages: ChatMessage[];
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
  goldenLines: ChatMessage[];
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
