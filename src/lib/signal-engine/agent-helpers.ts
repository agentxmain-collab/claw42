import type { LocalizedText, MarketDirection } from "@/types/common";
import type { ImpactLevel, SignalCard } from "@/types/signal";

export type AgentSignalPayload = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  primaryAsset: string;
  direction: MarketDirection | null;
  confidence: number;
  impactLevel: ImpactLevel;
  whyItMatters: LocalizedText;
  watchPoints: LocalizedText[];
  risks: LocalizedText[];
  evidenceCount: number;
  evidenceSources: string[];
  asPrompt: LocalizedText;
  asFunctionCall: {
    name: "hotpursuit_signal";
    arguments: Record<string, unknown>;
  };
};

export function toAgentSignalPayload(signal: SignalCard): AgentSignalPayload {
  return {
    id: signal.id,
    title: signal.facts.title,
    summary: signal.facts.summary,
    primaryAsset: signal.impact.primaryAsset,
    direction: signal.judgment.direction,
    confidence: signal.judgment.confidence,
    impactLevel: signal.judgment.impactLevel,
    whyItMatters: signal.explanation.whyItMatters,
    watchPoints: signal.explanation.watchPoints,
    risks: signal.judgment.riskNotes,
    evidenceCount: signal.evidence.confirmCount,
    evidenceSources: uniqueEvidenceSources(signal),
    asPrompt: {
      zh: buildPrompt(signal, "zh"),
      en: buildPrompt(signal, "en")
    },
    asFunctionCall: {
      name: "hotpursuit_signal",
      arguments: {
        id: signal.id,
        title: signal.facts.title,
        summary: signal.facts.summary,
        primaryAsset: signal.impact.primaryAsset,
        direction: signal.judgment.direction,
        confidence: signal.judgment.confidence,
        impactLevel: signal.judgment.impactLevel,
        evidenceCount: signal.evidence.confirmCount,
        evidenceSources: uniqueEvidenceSources(signal),
        watchPoints: signal.explanation.watchPoints,
        risks: signal.judgment.riskNotes
      }
    }
  };
}

function uniqueEvidenceSources(signal: SignalCard) {
  return Array.from(new Set([signal.facts.source, ...signal.evidence.pieces.map((piece) => piece.source)]));
}

function buildPrompt(signal: SignalCard, locale: keyof LocalizedText) {
  const watchPoints = signal.explanation.watchPoints.map((item) => item[locale]).join("；");
  const risks = signal.judgment.riskNotes.map((item) => item[locale]).join("；");

  if (locale === "zh") {
    return `${signal.facts.title.zh}。主要资产：${signal.impact.primaryAsset}。方向：${signal.judgment.direction ?? "观察"}，置信度：${signal.judgment.confidence}。原因：${signal.explanation.whyItMatters.zh}。观察点：${watchPoints}。风险：${risks}`;
  }

  return `${signal.facts.title.en}. Primary asset: ${signal.impact.primaryAsset}. Direction: ${signal.judgment.direction ?? "watch"}, confidence: ${signal.judgment.confidence}. Why it matters: ${signal.explanation.whyItMatters.en}. Watch points: ${watchPoints}. Risks: ${risks}`;
}
