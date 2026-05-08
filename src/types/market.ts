import type { LocalizedText, Severity, Tone } from "@/types/common";

export type MarketSentiment = {
  label: LocalizedText;
  tone: Tone;
  fearGreed: number;
  btcDominance: string;
  marketCapChange24h: string;
  updatedAt: string;
};

export type QuickInsightItem = {
  id: string;
  label: LocalizedText;
  value: LocalizedText;
  detail: LocalizedText;
  severity: Severity;
};
