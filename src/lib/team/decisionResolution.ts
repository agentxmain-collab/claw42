import { upsertDecisionRecord } from "@/lib/team/decisionRecordStore";
import type {
  DecisionOutcome,
  DecisionResolutionReason,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { MarketDataSource } from "@/modules/agent-watch/types";

export type { DecisionResolutionReason };

export interface DecisionResolutionResult {
  outcome: Exclude<DecisionOutcome, null>;
  resolvedAt: string;
  observedPrice: number;
  observedPriceSource: MarketDataSource | null;
  reason: DecisionResolutionReason;
}

export type DecisionRecordWriter = (record: StrategyDecisionRecord) => Promise<void>;

export function evaluateDecisionResolution(
  record: StrategyDecisionRecord,
  observedPrice: number,
  now = Date.now(),
  observedPriceSource: MarketDataSource | null = null,
): DecisionResolutionResult | null {
  const decision = record.tradeDecision;
  if (
    record.resolvedOutcome ||
    !decision ||
    decision.direction === "wait" ||
    !Number.isFinite(observedPrice) ||
    observedPrice <= 0
  ) {
    return null;
  }

  const takeProfitHit = isTakeProfitHit(decision, observedPrice);
  if (takeProfitHit)
    return result("hit_tp", "take_profit_reached", observedPrice, observedPriceSource, now);

  const stopLossHit = isStopLossHit(decision, observedPrice);
  if (stopLossHit)
    return result("hit_sl", "stop_loss_reached", observedPrice, observedPriceSource, now);

  if (windowElapsed(record.evaluationWindowEndsAt, now)) {
    return result("expired", "evaluation_window_elapsed", observedPrice, observedPriceSource, now);
  }

  return null;
}

export function applyDecisionResolution(
  record: StrategyDecisionRecord,
  resolution: DecisionResolutionResult,
): StrategyDecisionRecord {
  return {
    ...record,
    resolvedAt: resolution.resolvedAt,
    resolvedOutcome: resolution.outcome,
    resolvedPrice: resolution.observedPrice,
    resolutionReason: resolution.reason,
    resolutionPriceSource: resolution.observedPriceSource,
  };
}

export async function resolveDecisionRecordFromPrice(
  record: StrategyDecisionRecord,
  observedPrice: number,
  now = Date.now(),
  writeRecord: DecisionRecordWriter = upsertDecisionRecord,
  observedPriceSource: MarketDataSource | null = null,
) {
  const resolution = evaluateDecisionResolution(record, observedPrice, now, observedPriceSource);
  if (!resolution) return null;

  const resolvedRecord = applyDecisionResolution(record, resolution);
  await writeRecord(resolvedRecord);
  return {
    resolution,
    record: resolvedRecord,
  };
}

function isTakeProfitHit(decision: TradeDecision, observedPrice: number) {
  const firstTarget = decision.takeProfit[0];
  if (!firstTarget || firstTarget <= 0) return false;
  return decision.direction === "long"
    ? observedPrice >= firstTarget
    : observedPrice <= firstTarget;
}

function isStopLossHit(decision: TradeDecision, observedPrice: number) {
  if (!decision.stopLoss || decision.stopLoss <= 0) return false;
  return decision.direction === "long"
    ? observedPrice <= decision.stopLoss
    : observedPrice >= decision.stopLoss;
}

function windowElapsed(evaluationWindowEndsAt: string | null, now: number) {
  if (!evaluationWindowEndsAt) return false;
  const end = Date.parse(evaluationWindowEndsAt);
  return Number.isFinite(end) && now >= end;
}

function result(
  outcome: DecisionResolutionResult["outcome"],
  reason: DecisionResolutionReason,
  observedPrice: number,
  observedPriceSource: MarketDataSource | null,
  now: number,
): DecisionResolutionResult {
  return {
    outcome,
    reason,
    observedPrice,
    observedPriceSource,
    resolvedAt: new Date(now).toISOString(),
  };
}
