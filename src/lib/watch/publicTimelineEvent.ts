import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  DecisionOutcome,
  DecisionResolutionReason,
  DecisionStageTraceId,
  DecisionStageTraceStatus,
} from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { Locale } from "@/i18n/types";
import type { MarketDataSource } from "@/modules/agent-watch/types";

export type PublicTimelineSourceTrigger =
  | "market_signal"
  | "news"
  | "pm_decision"
  | "team_discussion"
  | "cron_heartbeat"
  | "fallback";

export type PublicTimelineImportance = "low" | "medium" | "high" | "critical";
export type PublicTimelineVisibility = "public" | "debug";

export interface PublicDecisionStageTraceEntry {
  stageId: DecisionStageTraceId;
  status: DecisionStageTraceStatus;
  observedAt: string;
  memberIds?: TeamMemberId[];
}

export type PublicTimelinePayload =
  | {
      kind: "market_signal";
      symbol: string;
      signalType: string;
      severity: string;
      threshold?: number;
      observedValue?: number;
      description?: string;
    }
  | { kind: "news"; evidenceId: string; symbols: string[] }
  | {
      kind: "pm_decision";
      recordId: string;
      symbol: string;
      tradeDecision?: TradeDecision | null;
      rationaleByMember: Partial<Record<TeamMemberId, string>>;
      citationsByMember?: Partial<Record<TeamMemberId, string[]>>;
      stageTrace?: PublicDecisionStageTraceEntry[];
      resolution?: {
        outcome: Exclude<DecisionOutcome, null>;
        resolvedAt: string;
        observedPrice?: number;
        observedPriceSource?: MarketDataSource;
        reason?: DecisionResolutionReason;
      };
    }
  | {
      kind: "team_discussion";
      recordId: string;
      turns: Array<{ memberId: TeamMemberId; text: string; citations: string[] }>;
    };

export interface PublicTimelineEvent {
  id: string;
  ts: number;
  visibility: PublicTimelineVisibility;
  importance: PublicTimelineImportance;
  sourceTrigger: PublicTimelineSourceTrigger;
  evidenceIds: string[];
  locale: Locale;
  payload: PublicTimelinePayload;
}

export const PUBLIC_IMPORTANCE_ORDER: Record<PublicTimelineImportance, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
