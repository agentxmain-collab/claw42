export type CoinSymbol = "BTC" | "ETH" | "SOL" | "USDT";
export type AgentId = "alpha" | "beta" | "gamma";
export type AgentStatus = "thinking" | "speaking" | "idle";
export type AnalysisSource =
  | "minimax"
  | "deepseek"
  | "claude"
  | "cache"
  | "static-fallback";
export type ProviderSource = "minimax" | "deepseek" | "claude";

export interface TickerData {
  price: number;
  change24h: number;
}

export type TickerMap = Record<CoinSymbol, TickerData>;

export interface MarketTickerPayload {
  ts: number;
  tickers: TickerMap;
  isStale?: boolean;
  isFallback?: boolean;
  error?: "ticker_unavailable";
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
}

export interface AgentWatchMessage {
  id: string;
  agentId: AgentId;
  content: string;
  timestamp: number;
}
