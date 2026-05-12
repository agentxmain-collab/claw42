import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { MarketTickerPayload } from "../types";

export type DispatchView = "flow" | "mkt";

export type DispatchTopicStatus = "active" | "done" | "pending";

export type DispatchStageStatus = "done" | "active" | "pending" | "final";

export type DispatchAgentId =
  | "fundamental_analyst"
  | "sentiment_analyst"
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
  agentName: string;
  time: string;
  dataAge?: string;
  mentions: string[];
  quote?: {
    agentName: string;
    text: string;
  };
  content: string;
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

export interface DispatchTopic {
  id: string;
  symbol: string;
  status: DispatchTopicStatus;
  title: string;
  originalUrl: string;
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
  defaultCollapsed: boolean;
}

export interface DispatchConsoleV9Props {
  events?: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
  marketSnapshot?: MarketTickerPayload | null;
  initialView?: DispatchView;
}
