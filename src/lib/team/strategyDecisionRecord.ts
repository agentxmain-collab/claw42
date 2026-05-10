import type { DebateDirection, FactionId } from "@/lib/types";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { TradeDecision } from "@/lib/team/tradeDecision";

export type RecordSource = "live" | "paper" | "legacy" | "backtest";

export type DecisionOutcome = "hit_tp" | "hit_sl" | "expired" | "manual_close" | null;

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
}

export interface StrategyDecisionRecord {
  /** Stable record id. */
  id: string;
  /** Schema version for future migrations. */
  schemaVersion: 1;
  /** Origin of this record: real live output, paper output, old legacy replay, or backtest. */
  recordSource: RecordSource;
  /** Uppercase market symbol such as BTC or ETH. */
  symbol: string;
  /** PM owner for new records; legacy data remains explicitly bucketed as legacy. */
  decisionOwnerId: TeamMemberId | "legacy";
  /** Analysts that contributed to the decision. Empty for legacy replay records. */
  contributorIds: TeamMemberId[];
  /** Per-analyst decision inputs. Empty until spec-2/spec-4 populate structured evidence. */
  analystInputs: AnalystInputRecord[];
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
  /** Prompt version used to generate the decision. */
  promptVersion: string;
  /** Provider/model family used to generate the decision. */
  modelProvider: string;
  /** Optional legacy faction id, only for old replay/backfill records. */
  legacyFactionId?: FactionId | null;
}
