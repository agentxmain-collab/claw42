import type {
  AnalystDirection,
  AnalystInputRecord,
  AnalystInputRoundRecord,
  StrategyDecisionRecord,
} from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import { containsPublicContentLeak } from "@/lib/watch/publicContentGuardrails";

export type DecisionQualityWarning =
  | "public_content_leak"
  | "duplicate_public_rationale"
  | "low_role_coverage"
  | "all_wait_or_neutral"
  | "missing_trade_card_for_executable_symbol"
  | "thin_evidence"
  | "low_confidence_trade";

export interface DecisionQualityReport {
  schemaVersion: 1;
  score: number;
  publishable: boolean;
  warningCount: number;
  warnings: DecisionQualityWarning[];
  blockingWarnings: DecisionQualityWarning[];
  leakCount: number;
  duplicateRationaleCount: number;
  roleCoverage: {
    active: number;
    contributorCount: number;
    analystInputCount: number;
  };
  directionDistribution: Record<AnalystDirection, number>;
  evidence: {
    citedEvidenceCount: number;
    analystCitationCount: number;
  };
  trade: {
    hasTradeCard: boolean;
    direction: TradeDecision["direction"] | null;
    confidence: number | null;
    actionable: boolean;
  };
}

const LOW_ROLE_COVERAGE_THRESHOLD = 6;
const MIN_EVIDENCE_CITATIONS = 2;
const LOW_TRADE_CONFIDENCE_THRESHOLD = 0.5;

export function assessDecisionQuality(record: StrategyDecisionRecord): DecisionQualityReport {
  const textFields = collectPublicDecisionText(record);
  const leakCount = textFields.filter((value) => containsPublicContentLeak(value)).length;
  const duplicateRationaleCount = countDuplicateRationales(textFields);
  const activeMemberIds = new Set([
    ...record.contributorIds,
    ...record.analystInputs.map((input) => input.memberId),
  ]);
  const directionDistribution = countDirections(record.analystInputs);
  const citedEvidenceIds = collectEvidenceIds(record);
  const analystCitationCount = countAnalystEvidenceCitations(record.analystInputs);
  const trade = summarizeTrade(record.tradeDecision);
  const warnings = uniqueWarnings([
    leakCount > 0 ? "public_content_leak" : null,
    duplicateRationaleCount > 0 ? "duplicate_public_rationale" : null,
    activeMemberIds.size < LOW_ROLE_COVERAGE_THRESHOLD ? "low_role_coverage" : null,
    directionDistribution.long + directionDistribution.short === 0 ? "all_wait_or_neutral" : null,
    isExecutableSymbolCandidate(record) && !trade.hasTradeCard
      ? "missing_trade_card_for_executable_symbol"
      : null,
    citedEvidenceIds.size < MIN_EVIDENCE_CITATIONS ? "thin_evidence" : null,
    trade.hasTradeCard &&
    typeof trade.confidence === "number" &&
    trade.confidence < LOW_TRADE_CONFIDENCE_THRESHOLD
      ? "low_confidence_trade"
      : null,
  ]);
  const blockingWarnings = warnings.filter(isPublicBlockingWarning);

  return {
    schemaVersion: 1,
    score: scoreFromSignals({
      leakCount,
      duplicateRationaleCount,
      activeRoleCount: activeMemberIds.size,
      hasDirectionalView: directionDistribution.long + directionDistribution.short > 0,
      missingExecutableTradeCard: warnings.includes("missing_trade_card_for_executable_symbol"),
      citedEvidenceCount: citedEvidenceIds.size,
      lowConfidenceTrade: warnings.includes("low_confidence_trade"),
    }),
    publishable: blockingWarnings.length === 0,
    warningCount: warnings.length,
    warnings,
    blockingWarnings,
    leakCount,
    duplicateRationaleCount,
    roleCoverage: {
      active: activeMemberIds.size,
      contributorCount: record.contributorIds.length,
      analystInputCount: record.analystInputs.length,
    },
    directionDistribution,
    evidence: {
      citedEvidenceCount: citedEvidenceIds.size,
      analystCitationCount,
    },
    trade,
  };
}

function isPublicBlockingWarning(warning: DecisionQualityWarning) {
  return (
    warning === "public_content_leak" || warning === "missing_trade_card_for_executable_symbol"
  );
}

function collectPublicDecisionText(record: StrategyDecisionRecord) {
  return [
    record.analysisSummary,
    ...record.analystInputs.flatMap((input) => [
      input.rationale,
      input.oneLineSummary,
      input.detailedRationale,
      ...(input.rounds ?? []).flatMap((round) => [
        round.rationale,
        round.oneLineSummary,
        round.detailedRationale,
      ]),
    ]),
    record.tradeDecision?.riskNote,
    record.tradeDecision?.invalidatesIf,
  ].filter((value): value is string => Boolean(value?.trim()));
}

function countDuplicateRationales(values: readonly string[]) {
  const counts = new Map<string, number>();
  values
    .map(normalizeText)
    .filter((value) => value.length >= 24)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.values()).reduce((total, count) => total + Math.max(0, count - 1), 0);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function countDirections(
  analystInputs: readonly AnalystInputRecord[],
): Record<AnalystDirection, number> {
  return analystInputs.reduce<Record<AnalystDirection, number>>(
    (counts, input) => {
      counts[input.direction] += 1;
      return counts;
    },
    { long: 0, short: 0, neutral: 0, wait: 0 },
  );
}

function collectEvidenceIds(record: StrategyDecisionRecord) {
  return new Set([
    ...record.analystInputs.flatMap((input) => [
      ...input.evidenceIds,
      ...(input.rounds ?? []).flatMap(roundEvidenceIds),
    ]),
    ...(record.tradeDecision?.evidenceIds ?? []),
  ]);
}

function roundEvidenceIds(round: AnalystInputRoundRecord) {
  return round.evidenceIds;
}

function countAnalystEvidenceCitations(analystInputs: readonly AnalystInputRecord[]) {
  return analystInputs.reduce(
    (total, input) =>
      total +
      input.evidenceIds.length +
      (input.rounds ?? []).reduce((roundTotal, round) => roundTotal + round.evidenceIds.length, 0),
    0,
  );
}

function summarizeTrade(tradeDecision: TradeDecision | null): DecisionQualityReport["trade"] {
  return {
    hasTradeCard: Boolean(tradeDecision),
    direction: tradeDecision?.direction ?? null,
    confidence: tradeDecision?.confidence ?? null,
    actionable:
      Boolean(tradeDecision) &&
      (tradeDecision?.direction === "long" || tradeDecision?.direction === "short") &&
      tradeDecision.entryPrice !== null &&
      tradeDecision.stopLoss !== null &&
      tradeDecision.takeProfit.length > 0,
  };
}

function isExecutableSymbolCandidate(record: StrategyDecisionRecord) {
  const candidateType = record.candidate?.candidateType ?? "symbol";
  return candidateType === "symbol" && record.candidate?.executable !== false;
}

function uniqueWarnings(warnings: Array<DecisionQualityWarning | null>): DecisionQualityWarning[] {
  return Array.from(
    new Set(warnings.filter((warning): warning is DecisionQualityWarning => Boolean(warning))),
  );
}

function scoreFromSignals({
  leakCount,
  duplicateRationaleCount,
  activeRoleCount,
  hasDirectionalView,
  missingExecutableTradeCard,
  citedEvidenceCount,
  lowConfidenceTrade,
}: {
  leakCount: number;
  duplicateRationaleCount: number;
  activeRoleCount: number;
  hasDirectionalView: boolean;
  missingExecutableTradeCard: boolean;
  citedEvidenceCount: number;
  lowConfidenceTrade: boolean;
}) {
  const penalties = [
    Math.min(60, leakCount * 30),
    Math.min(24, duplicateRationaleCount * 8),
    activeRoleCount < LOW_ROLE_COVERAGE_THRESHOLD ? 12 : 0,
    hasDirectionalView ? 0 : 15,
    missingExecutableTradeCard ? 20 : 0,
    citedEvidenceCount < MIN_EVIDENCE_CITATIONS ? 10 : 0,
    lowConfidenceTrade ? 8 : 0,
  ];
  const score = 100 - penalties.reduce((total, penalty) => total + penalty, 0);
  return Math.max(0, Math.min(100, score));
}
