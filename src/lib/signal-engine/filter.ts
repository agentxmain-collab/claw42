import { isCredibleSource } from "@/lib/signal-engine/ingest";
import type { RawCandidate, RuleEvaluation } from "@/lib/signal-engine/types";

export function evaluateRules(candidate: RawCandidate): RuleEvaluation[] {
  return [
    evaluateMultiSource(candidate),
    evaluateMarketAnomaly(candidate),
    evaluateHighCredibilityNews(candidate),
    evaluateMacroDeviation(candidate)
  ];
}

function evaluateMultiSource(candidate: RawCandidate): RuleEvaluation {
  const count = candidate.evidence.length;
  const score = Math.min(100, count * 35);
  return { name: "multi_source_confirm", score, triggered: count >= 2 };
}

function evaluateMarketAnomaly(candidate: RawCandidate): RuleEvaluation {
  const change = Math.abs(candidate.marketSnapshot?.change24h ?? 0);
  const score = Math.min(100, Math.round(change * 10));
  return { name: "market_anomaly", score, triggered: change >= 5 };
}

function evaluateHighCredibilityNews(candidate: RawCandidate): RuleEvaluation {
  const credible = isCredibleSource(candidate.source);
  return { name: "high_credibility_news", score: credible ? 80 : 50, triggered: credible };
}

function evaluateMacroDeviation(candidate: RawCandidate): RuleEvaluation {
  if (!candidate.macroItem) {
    return { name: "macro_deviation", score: candidate.eventType === "macro" ? 45 : 0, triggered: false };
  }
  const forecast = parseFloat(candidate.macroItem.forecast);
  const actual = parseFloat(candidate.macroItem.actual);
  if (!Number.isFinite(forecast) || !Number.isFinite(actual) || forecast === 0) {
    return { name: "macro_deviation", score: 35, triggered: false };
  }
  const deviationPct = Math.abs((actual - forecast) / forecast) * 100;
  const score = Math.min(100, Math.round(deviationPct * 20));
  return { name: "macro_deviation", score, triggered: score >= 30 };
}
