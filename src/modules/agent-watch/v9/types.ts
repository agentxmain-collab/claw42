import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { DispatchV10FollowTradeDict } from "@/i18n/types";
import type { TradingReadinessState } from "@/lib/coinw/tradeReadinessState";
import type { AnalystDataStatus, AnalystDirection } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { CandidateType } from "@/lib/watch/decisionCandidate";
import type { ResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";
import type { MarketTickerPayload } from "../types";

export type DispatchView = "flow" | "mkt";

export type DispatchTopicStatus = "active" | "done" | "pending";

export type DispatchStageStatus = "done" | "active" | "in_progress" | "pending" | "final";

export type DispatchAgentId =
  | "fundamental_analyst"
  | "onchain_analyst"
  | "news_analyst"
  | "technical_analyst"
  | "bullish_researcher"
  | "bearish_researcher"
  | "trader"
  | "aggressive_reviewer"
  | "neutral_reviewer"
  | "conservative_reviewer"
  | "portfolio_manager"
  | "memory_loop";

export interface DispatchFlowAgent {
  id: DispatchAgentId;
  name: string;
  role: string;
  desc: string;
  avatarClass: string;
}

export interface DispatchFlowDetail {
  label: string;
  value: string;
}

export interface DispatchFlowStage {
  num: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  tag: string;
  countLabel: string;
  variant?: "debate" | "final" | "memory";
  agents: DispatchFlowAgent[];
  detail: DispatchFlowDetail[];
  footerChip: string;
}

export interface DispatchStageMarker {
  id: string;
  label: string;
  status: DispatchStageStatus;
  note?: string;
}

export interface DispatchMessage {
  id: string;
  stageId: string;
  agentId: DispatchAgentId;
  sourceMemberId?: TeamMemberId;
  agentName: string;
  time: string;
  dataAge?: string;
  roundLabel?: string;
  mentions: string[];
  quote?: {
    agentName: string;
    text: string;
  };
  content: string;
  direction?: AnalystDirection;
  directionLabel?: string;
  confidence?: number;
  oneLineSummary?: string;
  detailedRationale?: string;
  dataStatus?: AnalystDataStatus;
  dataStatusLabel?: string;
  roleViewpoint?: string;
  typing?: boolean;
}

export interface DispatchStrategy {
  action: "wait" | "long" | "short" | "pending";
  actionLabel: string;
  name: string;
  ticker: string;
  meta: string;
  metaHighlight?: {
    text: string;
    tone: "ok" | "warn" | "lime";
  };
  entry: string;
  stopLoss: string;
  takeProfit: string;
  follow: {
    primaryLabel: string;
    primaryDisabled: boolean;
    secondaryLabel: string;
    watchCount: number;
    followCount: number;
    expiryNote?: string;
  };
}

export interface DispatchTopicExecutionMode {
  executable: boolean;
  coinwPair: string | null;
  tradeUrl?: string;
  watchOnly: boolean;
  watchOnlyReason?: "not_listed_on_coinw" | "mapping_unknown";
  tradeReadiness?: {
    stateVersion: number;
    blocking: boolean;
    states: TradingReadinessState[];
  };
}

export type DispatchFreshnessStatus =
  | "idle"
  | "cached"
  | "stale"
  | "refreshing"
  | "locked"
  | "no_signal"
  | "error";

export interface DispatchFreshnessState {
  status: DispatchFreshnessStatus;
  symbol?: string | null;
  lastDecisionAt?: string | null;
  nextAllowedAt?: string | null;
  refreshStarted?: boolean;
  refreshSource?: "records" | "timeline" | "none";
  residentStatus?: ResidentPrewarmStatus;
}

export interface DispatchTopic {
  id: string;
  candidateType?: CandidateType;
  candidateKey?: string;
  displayTitle?: string;
  symbol: string;
  lastUpdatedAt?: number;
  execution?: DispatchTopicExecutionMode;
  status: DispatchTopicStatus;
  title: string;
  explanation?: string;
  originalUrl?: string;
  sourceLabel?: string;
  startedAt: string;
  progress: string;
  intensity: number;
  trigger: {
    ticker: string;
    text: string;
  };
  stages: DispatchStageMarker[];
  messages: DispatchMessage[];
  strategy: DispatchStrategy;
  topicRanking?: {
    score: number;
    intensity: number;
    rank: number;
    rankLabel: string;
    explanation: string;
  };
  defaultCollapsed: boolean;
}

export type DispatchTopicAction = "primary" | "secondary";

export interface DispatchConsoleV9Props {
  events?: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
  marketSnapshot?: MarketTickerPayload | null;
  topics?: DispatchTopic[];
  initialView?: DispatchView;
  onViewChange?: (view: DispatchView) => void;
  onTopicAction?: (
    topic: DispatchTopic,
    actionLabel: string,
    action: DispatchTopicAction,
  ) => void | Promise<void>;
  followTradeDict?: DispatchV10FollowTradeDict;
  freshness?: DispatchFreshnessState;
}
