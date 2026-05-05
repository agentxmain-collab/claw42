export type CoinSymbol = "BTC" | "ETH" | "SOL" | "USDT";
export type AgentId = "alpha" | "beta" | "gamma";
export type AgentStatus = "thinking" | "speaking" | "idle";
export type AnalysisSource = "minimax" | "deepseek" | "claude" | "cache" | "static-fallback";
export type ProviderSource = "minimax" | "deepseek" | "claude";

export interface TickerData {
  price: number;
  change24h: number;
}

export type TickerMap = Record<CoinSymbol, TickerData>;
export type MarketDataSource = "coinw-kline" | "coingecko-ticker" | "fallback";
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
}
