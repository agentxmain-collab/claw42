import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type {
  AnalystDataStatus,
  AnalystDirection,
  DecisionOutcome,
  DecisionResolutionReason,
  DecisionStageTraceId,
  DecisionStageTraceStatus,
} from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { Locale } from "@/i18n/types";
import type { CandidateType } from "@/lib/watch/decisionCandidate";
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

export interface PublicDecisionRoundEntry {
  round: number;
  memberId: TeamMemberId;
  direction?: AnalystDirection;
  confidence?: number;
  rationale: string;
  oneLineSummary?: string;
  detailedRationale?: string;
  dataStatus?: AnalystDataStatus;
  evidenceIds?: string[];
  observedAt?: string;
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
      /** Candidate contract fields are optional so old records remain public. */
      candidateType?: CandidateType;
      candidateKey?: string;
      displayTitle?: string;
      /** Whether this record can be used for follow-trade actions. Missing means legacy payload. */
      executable?: boolean;
      tradeDecision?: TradeDecision | null;
      rationaleByMember: Partial<Record<TeamMemberId, string>>;
      citationsByMember?: Partial<Record<TeamMemberId, string[]>>;
      rounds?: PublicDecisionRoundEntry[];
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
