import { priceSnapshots } from "@/lib/data/mock-db";
import { attachActions } from "@/lib/signal-engine/action-match";
import { dedupSignals } from "@/lib/signal-engine/dedup";
import { derateSignal } from "@/lib/signal-engine/derate";
import { ingestCandidates, ingestCandidatesAsync } from "@/lib/signal-engine/ingest";
import { getStructuringProvider } from "@/lib/signal-engine/providers";
import { structureCandidate, structureCandidateAsync } from "@/lib/signal-engine/structure";
import { getCachedSignals } from "@/lib/signal-engine/store";
import type { StructuringProvider } from "@/lib/signal-engine/providers/types";
import type { AssetBrief, ImpactLevel, MajorEventAnalysis, SignalCard } from "@/types/signal";

export function buildSignals() {
  return finalizeSignals(ingestCandidates().map(structureCandidate));
}

export async function buildSignalsAsync(provider: StructuringProvider = getStructuringProvider()) {
  const candidates = await ingestCandidatesAsync();
  const signals = await Promise.all(candidates.map((candidate) => structureCandidateAsync(candidate, provider)));
  return finalizeSignals(signals);
}

function finalizeSignals(signals: SignalCard[]) {
  return dedupSignals(signals)
    .map(derateSignal)
    .map(attachActions)
    .sort(compareSignals);
}

export async function getSignals(): Promise<SignalCard[]> {
  return getCachedSignals(buildSignalsAsync);
}

export async function getSignalById(id: string): Promise<SignalCard | null> {
  const signals = await getSignals();
  return signals.find((signal) => signal.id === id) ?? null;
}

export async function getHotSignals(limit = 5, level?: ImpactLevel): Promise<SignalCard[]> {
  const signals = await getSignals();
  const filtered = level ? signals.filter((signal) => signal.judgment.impactLevel === level) : signals;
  return filtered.slice(0, Math.min(Math.max(limit, 1), 10));
}

export async function getAssetBrief(symbol: string, window: "24h" | "7d" = "24h"): Promise<AssetBrief> {
  const normalized = symbol.toUpperCase();
  const signals = await getSignals();
  const relatedSignals = signals.filter(
    (signal) => signal.impact.primaryAsset === normalized || signal.impact.relatedAssets.some((asset) => asset.symbol === normalized) || (normalized === "MARKET" && signal.facts.eventType === "macro")
  );
  const aggregateConfidence = relatedSignals.length ? Math.round(relatedSignals.reduce((sum, signal) => sum + signal.judgment.confidence, 0) / relatedSignals.length) : 0;
  const aggregateDirection = relatedSignals.find((signal) => signal.judgment.direction)?.judgment.direction ?? null;

  return {
    symbol: normalized,
    priceSnapshot: priceSnapshots.find((snapshot) => snapshot.symbol === normalized) ?? null,
    relatedSignals,
    timeline: relatedSignals.flatMap((signal) => signal.evidence.timeline).sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).slice(0, window === "24h" ? 6 : 12),
    aggregateDirection,
    aggregateConfidence,
    aggregateRisks: relatedSignals.flatMap((signal) => signal.judgment.riskNotes).slice(0, 3)
  };
}

export async function getMajorEvent(): Promise<MajorEventAnalysis> {
  const signals = await getSignals();
  const event = signals.find((signal) => signal.engine.isHeadliner) ?? null;

  return {
    event,
    causalChain: event ? [event.explanation.whyItMatters, event.explanation.marketContext, ...event.explanation.watchPoints] : [],
    evidence: event?.evidence.pieces ?? [],
    impactRanking: event ? [...event.impact.relatedAssets].sort((a, b) => impactWeight(b.impactLevel) - impactWeight(a.impactLevel)) : [],
    actions: event?.actions ?? []
  };
}

function compareSignals(a: SignalCard, b: SignalCard) {
  if (a.engine.isHeadliner !== b.engine.isHeadliner) return a.engine.isHeadliner ? -1 : 1;
  if (a.engine.candidateScore !== b.engine.candidateScore) return b.engine.candidateScore - a.engine.candidateScore;
  return new Date(b.facts.publishedAt).getTime() - new Date(a.facts.publishedAt).getTime();
}

function impactWeight(level: ImpactLevel) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[level];
}
