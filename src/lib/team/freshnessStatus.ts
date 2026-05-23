export type DecisionFreshnessLevel = "fresh" | "aging" | "stale" | "expired";

export interface DecisionFreshnessStatus {
  level: DecisionFreshnessLevel;
  observedAt: string;
  ageMinutes: number;
  staleAfterMinutes: number;
  expiredAfterMinutes: number;
}

export const DECISION_FRESHNESS_THRESHOLDS = {
  agingAfterMinutes: 60,
  staleAfterMinutes: 6 * 60,
  expiredAfterMinutes: 24 * 60,
} as const;

export function calculateDecisionFreshnessStatus(
  observedAt: string | number,
  now = Date.now(),
): DecisionFreshnessStatus | null {
  const observedAtMs = typeof observedAt === "number" ? observedAt : Date.parse(observedAt);
  if (!Number.isFinite(observedAtMs)) return null;

  const ageMinutes = Math.max(0, Math.floor((now - observedAtMs) / 60_000));
  const level: DecisionFreshnessLevel =
    ageMinutes >= DECISION_FRESHNESS_THRESHOLDS.expiredAfterMinutes
      ? "expired"
      : ageMinutes >= DECISION_FRESHNESS_THRESHOLDS.staleAfterMinutes
        ? "stale"
        : ageMinutes >= DECISION_FRESHNESS_THRESHOLDS.agingAfterMinutes
          ? "aging"
          : "fresh";

  return {
    level,
    observedAt: new Date(observedAtMs).toISOString(),
    ageMinutes,
    staleAfterMinutes: DECISION_FRESHNESS_THRESHOLDS.staleAfterMinutes,
    expiredAfterMinutes: DECISION_FRESHNESS_THRESHOLDS.expiredAfterMinutes,
  };
}

export function isDecisionFreshEnoughForTrade(
  freshness: DecisionFreshnessStatus | null | undefined,
) {
  return !freshness || freshness.level === "fresh" || freshness.level === "aging";
}
