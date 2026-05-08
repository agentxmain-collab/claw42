import type { ImpactLevel } from "@/types/signal";
import type { RawCandidate } from "@/lib/signal-engine/types";
import type { StructuredFields, StructuringProvider } from "@/lib/signal-engine/providers/types";

export function structureWithStub(candidate: RawCandidate, score: number, impactLevel: ImpactLevel): StructuredFields {
  const confidence = Math.max(20, Math.min(92, score));
  const direction = confidence < 40 ? null : candidate.direction;

  return {
    whyItMatters: {
      zh: `${candidate.title.zh}会影响${candidate.primaryAsset === "MARKET" ? "整体市场" : candidate.primaryAsset}的短线定价和资金关注。`,
      en: `${candidate.title.en} can affect short-term pricing and attention around ${candidate.primaryAsset}.`
    },
    marketContext: {
      zh: candidate.marketSnapshot
        ? `${candidate.primaryAsset} 当前 24h 变化 ${candidate.marketSnapshot.change24h}%，需要结合事件进展观察。`
        : "当前缺少直接行情确认，先作为观察型信号处理。",
      en: candidate.marketSnapshot
        ? `${candidate.primaryAsset} is moving ${candidate.marketSnapshot.change24h}% over 24h, so follow-up confirmation matters.`
        : "Direct market confirmation is limited, so this is treated as a watch signal."
    },
    watchPoints: [
      { zh: "后续消息是否继续确认", en: "Whether follow-up news confirms the signal" },
      { zh: "相关资产成交量是否放大", en: "Whether related asset volume expands" }
    ],
    direction,
    confidence,
    impactLevel,
    riskNotes: [
      {
        zh: "该判断基于 mock 数据生成，不能替代真实交易决策。",
        en: "This judgment is generated from mock data and does not replace trading decisions."
      }
    ]
  };
}

export const stubStructuringProvider: StructuringProvider = {
  name: "stub",
  async structure(input) {
    return structureWithStub(input.candidate, input.score, input.impactLevel);
  }
};

export type { StructuredFields } from "@/lib/signal-engine/providers/types";
