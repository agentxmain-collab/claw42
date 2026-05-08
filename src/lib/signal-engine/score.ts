import type { ImpactLevel } from "@/types/signal";
import type { RuleEvaluation } from "@/lib/signal-engine/types";

const weights: Record<string, number> = {
  multi_source_confirm: 0.4,
  market_anomaly: 0.25,
  high_credibility_news: 0.2,
  macro_deviation: 0.15,
};

export function scoreCandidate(rules: RuleEvaluation[]) {
  return Math.round(
    rules.reduce((total, rule) => total + rule.score * (weights[rule.name] ?? 0), 0),
  );
}

export function impactFromScore(score: number): ImpactLevel {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function isHeadliner(score: number, rules: RuleEvaluation[]) {
  const hasStrongRule = rules.some(
    (rule) =>
      rule.triggered && (rule.name === "multi_source_confirm" || rule.name === "market_anomaly"),
  );
  return score >= 70 && hasStrongRule;
}
