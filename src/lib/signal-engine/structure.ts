import { severityToImpact } from "@/lib/signal-engine/ingest";
import { evaluateRules } from "@/lib/signal-engine/filter";
import { impactFromScore, isHeadliner, scoreCandidate } from "@/lib/signal-engine/score";
import { normalizeStructuredFields } from "@/lib/signal-engine/schema-guard";
import { structureWithStub, stubStructuringProvider } from "@/lib/signal-engine/providers/stub";
import { computeRating } from "@/lib/rating";
import type { StructuredFields, StructuringProvider } from "@/lib/signal-engine/providers/types";
import type { RawCandidate, RuleEvaluation } from "@/lib/signal-engine/types";
import type { AssetImpactRef, SignalCard } from "@/types/signal";

export function structureCandidate(candidate: RawCandidate): SignalCard {
  const context = evaluateCandidate(candidate);
  const structured = structureWithStub(candidate, context.score, context.impactLevel);
  return createSignalCard(candidate, structured, context);
}

export async function structureCandidateAsync(
  candidate: RawCandidate,
  provider: StructuringProvider = stubStructuringProvider,
): Promise<SignalCard> {
  const context = evaluateCandidate(candidate);
  const fallback = structureWithStub(candidate, context.score, context.impactLevel);
  let structured = fallback;

  try {
    const providerOutput = await provider.structure({
      candidate,
      rules: context.rules,
      score: context.score,
      impactLevel: context.impactLevel,
    });
    structured = normalizeStructuredFields(providerOutput, fallback);
  } catch (error) {
    console.warn(`[signal-engine] provider ${provider.name} failed, fallback to stub`, error);
    structured = fallback;
  }

  return createSignalCard(candidate, structured, context);
}

function evaluateCandidate(candidate: RawCandidate) {
  const rules = evaluateRules(candidate);
  const score = scoreCandidate(rules);
  const impactLevel = impactFromScore(score);
  return { rules, score, impactLevel };
}

function createSignalCard(
  candidate: RawCandidate,
  structured: StructuredFields,
  context: {
    rules: RuleEvaluation[];
    score: number;
    impactLevel: SignalCard["judgment"]["impactLevel"];
  },
): SignalCard {
  const date = candidate.publishedAt.slice(0, 10);

  const relatedAssets: AssetImpactRef[] = candidate.relatedAssets.map((asset) => ({
    symbol: asset.symbol,
    direction: asset.direction,
    impactLevel: severityToImpact(asset.severity),
    note: asset.note,
  }));

  return {
    id: candidate.id,
    version: 1,
    createdAt: candidate.publishedAt,
    updatedAt: candidate.publishedAt,
    facts: {
      title: candidate.title,
      summary: candidate.summary,
      fullSummary: candidate.fullSummary,
      source: candidate.source,
      publishedAt: candidate.publishedAt,
      eventType: candidate.eventType,
      eventStatus: candidate.eventStatus,
    },
    explanation: {
      whyItMatters: structured.whyItMatters,
      marketContext: structured.marketContext,
      watchPoints: structured.watchPoints,
    },
    judgment: {
      direction: structured.direction,
      confidence: structured.confidence,
      impactLevel: structured.impactLevel,
      riskNotes: structured.riskNotes,
      rating: computeRating(structured.direction, structured.confidence),
    },
    impact: {
      primaryAsset: candidate.primaryAsset,
      relatedAssets,
      tracks: candidate.tracks,
      tradingPairs: candidate.tradingPairs,
      projects: candidate.projects,
      campaignTags: candidate.campaignTags,
    },
    evidence: {
      pieces: candidate.evidence,
      timeline: candidate.timeline,
      multiSourceConfirm: candidate.evidence.length >= 2,
      confirmCount: candidate.evidence.length,
    },
    actions: [],
    engine: {
      candidateScore: context.score,
      isHeadliner: isHeadliner(context.score, context.rules),
      dedupKey: `${candidate.eventType}:${candidate.primaryAsset}:${date}`,
      rules: context.rules.filter((rule) => rule.triggered).map((rule) => rule.name),
    },
  };
}
