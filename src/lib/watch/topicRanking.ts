import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { PUBLIC_IMPORTANCE_ORDER, type PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import type { PmDecisionTimelineEvent } from "@/lib/watch/topicAggregator";

type EvidenceMap = Readonly<Record<string, NewsEvidence | undefined>>;
type Direction = "long" | "short" | "neutral" | "wait";

export interface TopicRankingScore {
  score: number;
  intensity: number;
  components: {
    severity: number;
    confidence: number;
    consensus: number;
    newsCountLog: number;
  };
  newsCount: number;
  confidencePercent: number;
}

export interface TopicRankingTextDict {
  explanation_template: string;
  rank_label: string;
}

const EVIDENCE_SEVERITY_ORDER: Record<NewsEvidence["impactSeverity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function replaceVars(template: string, vars: Readonly<Record<string, string | number>>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

function maxEvidenceSeverity(event: PublicTimelineEvent, evidenceMap: EvidenceMap = {}) {
  return event.evidenceIds.reduce((max, evidenceId) => {
    const severity = evidenceMap[evidenceId]?.impactSeverity;
    return severity ? Math.max(max, EVIDENCE_SEVERITY_ORDER[severity]) : max;
  }, 0);
}

function severityScore(event: PublicTimelineEvent, evidenceMap: EvidenceMap = {}) {
  const importance = PUBLIC_IMPORTANCE_ORDER[event.importance] / 3;
  const evidence = maxEvidenceSeverity(event, evidenceMap) / 3;
  return clamp(Math.max(importance, evidence), 0, 1);
}

function confidenceScore(event: PmDecisionTimelineEvent, confidence?: number | null) {
  if (typeof confidence === "number" && Number.isFinite(confidence)) return clamp(confidence, 0, 1);
  const roundConfidence = latestRoundConfidence(event);
  if (typeof roundConfidence === "number") return roundConfidence;
  return 0.5;
}

function latestRoundConfidence(event: PmDecisionTimelineEvent) {
  const rounds = event.payload.rounds ?? [];
  if (rounds.length === 0) return null;
  const latestRound = Math.max(...rounds.map((round) => round.round));
  const confidences = rounds
    .filter((round) => round.round === latestRound)
    .map((round) => round.confidence)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (confidences.length === 0) return null;
  return clamp(confidences.reduce((sum, value) => sum + value, 0) / confidences.length, 0, 1);
}

function consensusScore(event: PmDecisionTimelineEvent) {
  const directions = latestDirections(event);
  if (directions.length === 0) return 0.5;
  const counts = directions.reduce<Record<Direction, number>>(
    (next, direction) => ({
      ...next,
      [direction]: next[direction] + 1,
    }),
    { long: 0, short: 0, neutral: 0, wait: 0 },
  );
  return clamp(Math.max(...Object.values(counts)) / directions.length, 0, 1);
}

function latestDirections(event: PmDecisionTimelineEvent): Direction[] {
  const rounds = event.payload.rounds ?? [];
  if (rounds.length > 0) {
    const latestByAgent = new Map<string, { round: number; direction?: Direction }>();
    for (const round of rounds) {
      if (!round.direction) continue;
      const actorKey = round.memberId ?? round.agentId;
      if (!actorKey) continue;
      const current = latestByAgent.get(actorKey);
      if (!current || round.round >= current.round) {
        latestByAgent.set(actorKey, {
          round: round.round,
          direction: round.direction,
        });
      }
    }
    return Array.from(latestByAgent.values())
      .map((entry) => entry.direction)
      .filter((direction): direction is Direction => Boolean(direction));
  }

  const decisionDirection = event.payload.tradeDecision?.direction;
  if (
    decisionDirection === "long" ||
    decisionDirection === "short" ||
    decisionDirection === "wait"
  ) {
    return [decisionDirection];
  }
  return [];
}

function newsCountLogScore(newsCount: number) {
  return clamp(Math.log1p(Math.max(0, newsCount)) / Math.log1p(5), 0, 1);
}

export function calculateTopicRankingScore({
  event,
  evidenceMap,
  confidence,
}: {
  event: PmDecisionTimelineEvent;
  evidenceMap?: EvidenceMap;
  confidence?: number | null;
}): TopicRankingScore {
  const severity = severityScore(event, evidenceMap);
  const confidenceComponent = confidenceScore(event, confidence);
  const consensus = consensusScore(event);
  const newsCount = event.evidenceIds.length;
  const newsCountLog = newsCountLogScore(newsCount);
  const weighted =
    severity * 0.4 + confidenceComponent * 0.3 + consensus * 0.2 + newsCountLog * 0.1;
  const score = Math.round(clamp(weighted, 0, 1) * 100);

  return {
    score,
    intensity: clamp(Math.max(1, Math.ceil(score / 20)), 1, 5),
    components: {
      severity,
      confidence: confidenceComponent,
      consensus,
      newsCountLog,
    },
    newsCount,
    confidencePercent: Math.round(confidenceComponent * 100),
  };
}

export function formatTopicRanking({
  symbol,
  rank,
  ranking,
  dict,
}: {
  symbol: string;
  rank: number;
  ranking: TopicRankingScore;
  dict: TopicRankingTextDict;
}) {
  return {
    score: ranking.score,
    intensity: ranking.intensity,
    rank,
    rankLabel: replaceVars(dict.rank_label, { rank, score: ranking.score }),
    explanation: replaceVars(dict.explanation_template, {
      symbol,
      rank,
      score: ranking.score,
      news_count: ranking.newsCount,
      confidence: ranking.confidencePercent,
    }),
  };
}
