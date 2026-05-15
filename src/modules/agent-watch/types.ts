import type { ChatThread, NewsDebate } from "@/lib/types";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { Locale } from "@/i18n/types";

export type CoinSymbol = "BTC" | "ETH" | "SOL" | "USDT";
export type AgentId = "alpha" | "beta" | "gamma";
export type AgentStatus = "thinking" | "speaking" | "alert" | "idle";
export type AnalysisSource = "minimax" | "deepseek" | "claude" | "cache" | "static-fallback";
export type ProviderSource = "minimax" | "deepseek" | "claude";

export interface TickerData {
  price: number;
  change24h: number;
}

export type TickerMap = Record<CoinSymbol, TickerData>;
export type MarketDataSource = "coinw-kline" | "coingecko-ticker" | "fallback" | "admin_manual";
export type MajorCoinSymbol = Exclude<CoinSymbol, "USDT">;
export type CoinCategory = "majors" | "trending" | "opportunity";
export type SignalType =
  | "volume_spike"
  | "near_high"
  | "near_low"
  | "breakout"
  | "ema_cross"
  | "range_change";
export type SignalSeverity = "info" | "watch" | "alert";

export interface MarketCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeframeSignal {
  periodSec: number;
  candleCount: number;
  latestClose: number;
  changePct: number;
  high: number;
  low: number;
  support: number;
  resistance: number;
  volumeRatio: number | null;
  ema12: number | null;
  ema13: number | null;
  ema144: number | null;
  ema169: number | null;
  trend: "bullish" | "bearish" | "range";
}

export interface CoinMarketContext {
  pair: string;
  m5: TimeframeSignal | null;
  m15: TimeframeSignal | null;
  h4: TimeframeSignal | null;
}

export interface CoinTickerEntry {
  symbol: string;
  name?: string;
  price: number;
  change24h: number;
  category: CoinCategory;
}

export interface CoinPoolPayload {
  ts: number;
  tickers: TickerMap;
  majors: CoinTickerEntry[];
  trending: CoinTickerEntry[];
  opportunity: CoinTickerEntry[];
  signals?: Partial<Record<CoinSymbol, CoinMarketContext>>;
  source: MarketDataSource;
  isStale?: boolean;
  isFallback?: boolean;
  error?: "ticker_unavailable" | string;
}

export interface SignalRecord {
  id: string;
  ts: number;
  symbol: string;
  type: SignalType;
  severity: SignalSeverity;
  payload: {
    volumeRatio?: number;
    priceLevel?: number;
    distancePct?: number;
    emaState?: "golden_cross" | "dead_cross" | "above" | "below";
    change24h?: number;
    description?: string;
  };
}

export type WatchEntryVisibility = "public" | "debug";
export type WatchEntryImportance = "low" | "medium" | "high" | "critical";
export type WatchEntrySourceTrigger =
  | "market_signal"
  | "news"
  | "pm_decision"
  | "team_discussion"
  | "cron_heartbeat"
  | "fallback";

export interface WatchEntryMeta {
  visibility: WatchEntryVisibility;
  importance: WatchEntryImportance;
  sourceTrigger: WatchEntrySourceTrigger;
  evidenceIds: string[];
  locale: Locale;
  recordId?: string;
  tradeDecision?: TradeDecision | null;
}

export interface WatchEntryWithMeta {
  meta?: WatchEntryMeta;
}

export interface AgentFocus {
  agentId: AgentId;
  symbol: string;
  judgment: string;
  trigger: {
    type: "breakout_with_volume" | "retest_hold" | "ema_cross" | "range_break" | "custom";
    symbol: string;
    priceLevel?: number;
    volumeRatio?: number;
    description: string;
  };
  fail: {
    type: "price_break" | "volume_dry" | "ema_break" | "custom";
    symbol: string;
    priceLevel?: number;
    description: string;
  };
  evidenceCount: number;
  generatedAt: number;
}

export interface MarketTickerPayload {
  ts: number;
  tickers: TickerMap;
  source: MarketDataSource;
  pool?: CoinPoolPayload;
  coinw?: Partial<Record<CoinSymbol, CoinMarketContext>>;
  isStale?: boolean;
  isFallback?: boolean;
  error?: "ticker_unavailable";
}

export interface MarketEventPayload {
  servedAt: number;
  count: number;
  signals: SignalRecord[];
}

export interface StreamMessage {
  agentId: AgentId;
  content: string;
}

export interface StreamResponse {
  agentId: AgentId;
  content: string;
  symbol?: string;
  marketDataFetchedAt?: number;
}

export interface AgentMessage {
  kind: "agent_message";
  id: string;
  ts: number;
  agentId: AgentId;
  content: string;
  symbol?: string;
  symbols?: string[];
  triggerSignalId: string;
  marketDataFetchedAt?: number;
  meta?: WatchEntryMeta;
}

export interface CollectiveEvent {
  kind: "collective_event";
  id: string;
  ts: number;
  symbols: string[];
  direction: "up" | "down";
  signalType: SignalType;
  description: string;
  primaryResponse: StreamResponse;
  echoResponses: StreamResponse[];
  meta?: WatchEntryMeta;
}

export interface FocusEvent {
  kind: "focus_event";
  id: string;
  ts: number;
  symbol: string;
  signalType: SignalType;
  severity: "alert";
  description: string;
  primaryResponse: StreamResponse;
  meta?: WatchEntryMeta;
}

export interface ConflictEvent {
  kind: "conflict_event";
  id: string;
  ts: number;
  symbol: string;
  description: string;
  conflictingAgents: [AgentId, AgentId];
  responses: StreamResponse[];
  meta?: WatchEntryMeta;
}

export type WatchUpdateType =
  | "market_digest"
  | "focus_update"
  | "condition_update"
  | "agent_heartbeat"
  | "quiet_observation";

export interface WatchUpdateEntry {
  kind: "watch_update";
  id: string;
  ts: number;
  updateType: WatchUpdateType;
  title: string;
  content: string;
  dedupeKey: string;
  agentId?: AgentId;
  symbol?: string;
  symbols?: string[];
  marketDataFetchedAt?: number;
  severity: "neutral" | "watch";
  meta?: WatchEntryMeta;
}

export interface AgentDiscussionEntry {
  kind: "agent_discussion";
  id: string;
  ts: number;
  topic: string;
  summary: string;
  dedupeKey: string;
  symbol?: string;
  symbols: string[];
  responses: StreamResponse[];
  marketDataFetchedAt?: number;
  severity: "neutral" | "watch";
  meta?: WatchEntryMeta;
}

export interface NewsDebateEntry {
  kind: "news_debate";
  id: string;
  ts: number;
  debate: NewsDebate;
  meta?: WatchEntryMeta;
}

export interface ChatThreadEntry {
  kind: "chat_thread";
  id: string;
  ts: number;
  thread: ChatThread;
  meta?: WatchEntryMeta;
}

export type StreamEntry =
  | AgentMessage
  | CollectiveEvent
  | FocusEvent
  | ConflictEvent
  | WatchUpdateEntry
  | AgentDiscussionEntry
  | NewsDebateEntry
  | ChatThreadEntry;

export type CoinComments = Record<CoinSymbol, Record<AgentId, string>>;

export interface AgentAnalysisPayload {
  generatedAt: number;
  servedAt: number;
  ttl: number;
  source: AnalysisSource;
  tickers: TickerMap;
  pool?: CoinPoolPayload;
  focus?: AgentFocus[];
  marketSource: MarketDataSource;
  stream: StreamMessage[];
  streamEntries?: StreamEntry[];
  newsDebates?: NewsDebate[];
  heroBubbles: string[];
  coinComments: CoinComments;
  degraded?: boolean;
}

export interface HistoryMessageEntry {
  id: string;
  generatedAt: number;
  agentId: AgentId;
  content: string;
  tickerSnapshot: TickerMap;
  source: ProviderSource;
  triggerSignalId?: string;
}

export interface AgentSkill {
  id: string;
  displayName: string;
  tagline: string;
  color: string;
  persona: string;
  style: {
    tone: string;
    maxLength: number;
    bannedPhrases: string[];
    examples: string[];
  };
  terminology?: {
    required: string[];
    minPerMessage: number;
  };
  analyticalFramework: {
    coreLogic: string[];
  };
  fallbacks: {
    stream: string[];
    heroBubbles: string[];
    coinComments: Record<CoinSymbol, string>;
  };
}

export interface AgentDisplayMeta {
  id: AgentId;
  name: string;
  tagline: string;
  color: string;
  avatar: string;
  avatarSrc: string;
}

export interface AgentWatchMessage {
  id: string;
  agentId: AgentId;
  content: string;
  timestamp: number;
  triggerSignalId?: string;
}
