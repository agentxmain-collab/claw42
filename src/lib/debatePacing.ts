import type { DebatePacingPlan, NewsSeverity } from "@/lib/types";

const BASE_PACING: DebatePacingPlan = {
  roundOneDelayMs: 800,
  roundTwoDelayMs: 1200,
  strategyRevealDelayMs: 1500,
  utteranceIntervalMs: 1200,
  typingLeadMs: 900,
};

export function debatePacingForSeverity(severity: NewsSeverity): DebatePacingPlan {
  if (severity === "critical") {
    return {
      roundOneDelayMs: 400,
      roundTwoDelayMs: 900,
      strategyRevealDelayMs: 1200,
      utteranceIntervalMs: 1000,
      typingLeadMs: 750,
    };
  }

  if (severity === "high") return BASE_PACING;

  return {
    roundOneDelayMs: 1000,
    roundTwoDelayMs: 1400,
    strategyRevealDelayMs: 1800,
    utteranceIntervalMs: 1400,
    typingLeadMs: 1000,
  };
}

export function debateDisplayDurationMs(plan: DebatePacingPlan, utteranceCount = 9): number {
  return (
    plan.roundOneDelayMs +
    plan.roundTwoDelayMs +
    plan.strategyRevealDelayMs +
    utteranceCount * plan.utteranceIntervalMs +
    plan.typingLeadMs
  );
}
