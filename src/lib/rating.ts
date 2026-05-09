import type { DebateDirection } from "@/lib/types";
import type { MarketDirection } from "@/types/common";

export type Rating5Tier = "StrongBuy" | "Buy" | "Hold" | "Sell" | "StrongSell";

type RatingDirection = MarketDirection | DebateDirection | null | undefined;

function normalizedConfidence(confidence: number) {
  if (!Number.isFinite(confidence)) return 0;
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return Math.max(0, Math.min(1, normalized));
}

export function computeRating(direction: RatingDirection, confidence: number): Rating5Tier {
  const score = normalizedConfidence(confidence);
  if (
    direction === null ||
    direction === undefined ||
    direction === "neutral" ||
    direction === "wait" ||
    score < 0.5
  ) {
    return "Hold";
  }

  if (direction === "long" || direction === "bullish") {
    return score >= 0.8 ? "StrongBuy" : "Buy";
  }

  if (direction === "short" || direction === "bearish") {
    return score >= 0.8 ? "StrongSell" : "Sell";
  }

  return "Hold";
}

export function confidenceFromConsensusRatio(consensusRatio: string | null | undefined) {
  if (consensusRatio === "3:0" || consensusRatio === "0:3") return 0.85;
  if (consensusRatio === "2:1" || consensusRatio === "1:2") return 0.65;
  return 0.5;
}

export const RATING_COLOR: Record<Rating5Tier, string> = {
  StrongBuy: "var(--color-brand-purple)",
  Buy: "var(--color-brand-purple-bright)",
  Hold: "var(--color-fg-secondary)",
  Sell: "var(--color-func-yellow)",
  StrongSell: "var(--color-func-red)",
};

export const RATING_BG: Record<Rating5Tier, string> = {
  StrongBuy: "rgba(82, 39, 255, 0.15)",
  Buy: "rgba(108, 79, 255, 0.15)",
  Hold: "rgba(166, 166, 166, 0.15)",
  Sell: "rgba(254, 213, 0, 0.15)",
  StrongSell: "rgba(233, 80, 50, 0.15)",
};

export const RATING_ORDER: Rating5Tier[] = ["StrongBuy", "Buy", "Hold", "Sell", "StrongSell"];
