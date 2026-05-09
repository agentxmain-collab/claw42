import type { LocalizedText, MarketDirection } from "@/types/common";
import type { TimelineItem } from "@/types/news";
import type { Rating5Tier } from "@/lib/rating";

export type EventType =
  | "regulation"
  | "etf"
  | "macro"
  | "exchange"
  | "project"
  | "onchain"
  | "market_move"
  | "narrative";
export type EventStatus = "confirmed" | "developing" | "watching" | "expired";
export type ImpactLevel = "critical" | "high" | "medium" | "low";
export type SignalTrack =
  | "btc_eth"
  | "altcoin"
  | "defi"
  | "rwa"
  | "stablecoin"
  | "l2"
  | "ai"
  | "meme"
  | "infrastructure";
export type EvidenceKind = "news" | "market" | "macro" | "onchain" | "social";
export type ActionKind = "trade" | "alert" | "campaign" | "topic" | "external_api";

export type SignalFacts = {
  title: LocalizedText;
  summary: LocalizedText;
  fullSummary: LocalizedText;
  source: string;
  publishedAt: string;
  eventType: EventType;
  eventStatus: EventStatus;
};

export type SignalExplanation = {
  whyItMatters: LocalizedText;
  marketContext: LocalizedText;
  watchPoints: LocalizedText[];
};

export type SignalJudgment = {
  direction: MarketDirection | null;
  confidence: number;
  impactLevel: ImpactLevel;
  riskNotes: LocalizedText[];
  rating: Rating5Tier;
};

export type AssetImpactRef = {
  symbol: string;
  direction: MarketDirection;
  impactLevel: ImpactLevel;
  note: LocalizedText;
};

export type SignalImpact = {
  primaryAsset: string;
  relatedAssets: AssetImpactRef[];
  tracks: SignalTrack[];
  tradingPairs: string[];
  projects: string[];
  campaignTags: string[];
};

export type EvidencePiece = {
  kind: EvidenceKind;
  source: string;
  excerpt: LocalizedText;
  url?: string;
  capturedAt: string;
};

export type SignalEvidence = {
  pieces: EvidencePiece[];
  timeline: TimelineItem[];
  multiSourceConfirm: boolean;
  confirmCount: number;
};

export type SignalAction = {
  kind: ActionKind;
  label: LocalizedText;
  url?: string;
  payload?: Record<string, unknown>;
};

export type SignalCard = {
  id: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  facts: SignalFacts;
  explanation: SignalExplanation;
  judgment: SignalJudgment;
  impact: SignalImpact;
  evidence: SignalEvidence;
  actions: SignalAction[];
  engine: {
    candidateScore: number;
    isHeadliner: boolean;
    dedupKey: string;
    rules: string[];
  };
};

export type PriceSnapshot = {
  symbol: string;
  price: number;
  change24h: number;
  volumeChange24h: number;
  source: string;
  updatedAt: string;
};

export type AssetBrief = {
  symbol: string;
  priceSnapshot: PriceSnapshot | null;
  relatedSignals: SignalCard[];
  timeline: TimelineItem[];
  aggregateDirection: MarketDirection | null;
  aggregateConfidence: number;
  aggregateRisks: LocalizedText[];
};

export type MajorEventAnalysis = {
  event: SignalCard | null;
  causalChain: LocalizedText[];
  evidence: EvidencePiece[];
  impactRanking: AssetImpactRef[];
  actions: SignalAction[];
};

export type SignalHealthStatus = "healthy" | "degraded" | "blocked";
export type SignalDistributionMode = "auto" | "watch_only" | "hold";
export type SignalHealthCheckStatus = "pass" | "warn" | "fail";

export type SignalHealthCheck = {
  key: string;
  label: LocalizedText;
  status: SignalHealthCheckStatus;
  detail: LocalizedText;
};

export type SignalHealthMetrics = {
  signalCount: number;
  headlinerCount: number;
  lowConfidenceCount: number;
  multiSourceCount: number;
  evidencePieceCount: number;
  actionCount: number;
  staleSignalCount: number;
  newestSignalAt: string | null;
};

export type SignalHealth = {
  status: SignalHealthStatus;
  distributionMode: SignalDistributionMode;
  automationReady: boolean;
  humanInterventionRequired: boolean;
  provider: string;
  generatedAt: string;
  cacheTtlSeconds: number;
  metrics: SignalHealthMetrics;
  checks: SignalHealthCheck[];
};
