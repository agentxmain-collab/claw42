import type { DebateDirection, FactionId } from "@/lib/types";
import type { Locale } from "@/i18n/types";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { MarketDataSource } from "@/modules/agent-watch/types";

export type RecordSource = "live" | "paper" | "legacy" | "backtest";

export type DecisionOutcome = "hit_tp" | "hit_sl" | "expired" | "manual_close" | null;

export type DecisionResolutionReason =
  | "take_profit_reached"
  | "stop_loss_reached"
  | "evaluation_window_elapsed";

export type StrategyDecisionRecordSchemaVersion = 1 | 2;

export interface AnalystInputRoundRecord {
  /** One-based round number inside the PM decision debate. */
  round: number;
  /** Directional stance from this analyst during this round. */
  direction: Extract<DebateDirection, "long" | "short"> | "neutral";
  /** Normalized 0-1 confidence from the analyst output during this round. */
  confidence: number;
  /** Short rationale preserved for later audit and track-record explanation. */
  rationale: string;
  /** Structured evidence ids cited during this round. */
  evidenceIds: string[];
  /** ISO timestamp when this round output was observed. */
  observedAt: string;
}

export interface AnalystInputRecord {
  /** Team member who contributed this input. */
  memberId: TeamMemberId;
  /** Directional stance from this analyst at decision time. */
  direction: Extract<DebateDirection, "long" | "short"> | "neutral";
  /** Normalized 0-1 confidence from the analyst output. */
  confidence: number;
  /** Short rationale preserved for later audit and track-record explanation. */
  rationale: string;
  /** Structured evidence ids; populated by the news citation layer in spec-4. */
  evidenceIds: string[];
  /** Optional multi-round trace. Missing means legacy schema v1 single-round input. */
  rounds?: AnalystInputRoundRecord[];
}

export type DecisionStageTraceId =
  | "analyst_inputs"
  | "research_lead"
  | "risk_lead"
  | "trade_decision"
  | "record_write"
  | "public_timeline";

export type DecisionStageTraceStatus = "done" | "in_progress" | "pending" | "skipped" | "failed";

export interface DispatchStageRoundRecord {
  /** One-based round number inside this compressed internal stage. */
  round: number;
  /** Short stable label for debugging and future replay. */
  label: string;
  /** Current round status at record creation time. */
  status: DecisionStageTraceStatus;
  /** ISO timestamp when this round was observed by the pipeline. */
  observedAt: string;
  /** Team members involved in this round, when applicable. */
  memberIds?: TeamMemberId[];
  /** Optional short machine-readable detail. */
  note?: string;
}

export interface DecisionStageTraceEntry {
  /** Internal compressed pipeline stage id. This is not the public V9 stage id. */
  stageId: DecisionStageTraceId;
  /** Short stable label for debugging and future replay. */
  label: string;
  /** Current stage status at record creation time. */
  status: DecisionStageTraceStatus;
  /** ISO timestamp when this stage was observed by the pipeline. */
  observedAt: string;
  /** Internal ISO timestamp for stage start, when measured. Not part of public trace. */
  startedAt?: string;
  /** Internal ISO timestamp for stage completion, when measured. Not part of public trace. */
  completedAt?: string;
  /** Internal elapsed time for this compressed stage, when measured. Not part of public trace. */
  durationMs?: number;
  /** Team members involved in this internal stage, when applicable. */
  memberIds?: TeamMemberId[];
  /** Optional short machine-readable detail. */
  note?: string;
  /** Internal model/provider label used by this stage, if known. Not part of public trace. */
  modelProvider?: string;
  /** Internal prompt version used by this stage, if known. Not part of public trace. */
  promptVersion?: string;
  /** Optional multi-round trace for schema v2 records. */
  rounds?: DispatchStageRoundRecord[];
}

export interface StrategyDecisionRecord {
  /** Stable record id. */
  id: string;
  /** Schema version for future migrations. */
  schemaVersion: StrategyDecisionRecordSchemaVersion;
  /** Monotonic writer version for partial-stage CAS updates. */
  recordVersion?: number;
  /** Origin of this record: real live output, paper output, old legacy replay, or backtest. */
  recordSource: RecordSource;
  /** Uppercase market symbol such as BTC or ETH. */
  symbol: string;
  /** Locale used for all natural-language decision text. */
  locale: Locale;
  /** PM owner for new records; legacy data remains explicitly bucketed as legacy. */
  decisionOwnerId: TeamMemberId | "legacy";
  /** Analysts that contributed to the decision. Empty for legacy replay records. */
  contributorIds: TeamMemberId[];
  /** Per-analyst decision inputs. Empty until spec-2/spec-4 populate structured evidence. */
  analystInputs: AnalystInputRecord[];
  /** Non-public internal trace of the compressed PM decision pipeline. */
  stageTrace?: DecisionStageTraceEntry[];
  /** Chat/thread id that produced this decision, when known. */
  sourceThreadId: string | null;
  /**
   * Structured trade card. Spec-1 wrote a null id placeholder; spec-2 stores the
   * full TradeDecision object so later track-record views can audit the exact card.
   */
  tradeDecision: TradeDecision | null;
  /** ISO timestamp when the decision was created. */
  createdAt: string;
  /** ISO timestamp when this decision should be evaluated, if known. */
  evaluationWindowEndsAt: string | null;
  /** ISO timestamp when the decision was resolved, if resolved. */
  resolvedAt: string | null;
  /** Resolution state used by the track-record wall. */
  resolvedOutcome: DecisionOutcome;
  /** Market price observed when the decision resolved, if available. */
  resolvedPrice?: number | null;
  /** Machine-readable reason for the resolved outcome, if available. */
  resolutionReason?: DecisionResolutionReason | null;
  /** Market data source used for the resolution price, if available. */
  resolutionPriceSource?: MarketDataSource | null;
  /** Prompt version used to generate the decision. */
  promptVersion: string;
  /** Provider/model family used to generate the decision. */
  modelProvider: string;
  /** Optional legacy faction id, only for old replay/backfill records. */
  legacyFactionId?: FactionId | null;
}
