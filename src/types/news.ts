import type { LocalizedText, MarketDirection, Severity, Tone } from "@/types/common";

export type TimelineItem = {
  id: string;
  datetime: string;
  title: LocalizedText;
  detail: LocalizedText;
};

export type AssetImpact = {
  symbol: string;
  direction: MarketDirection;
  severity: Severity;
  note: LocalizedText;
};

export type NewsItem = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  fullSummary: LocalizedText;
  source: string;
  publishedAt: string;
  severity: Severity;
  tone: Tone;
  marketDirection: MarketDirection;
  outlook: {
    title: LocalizedText;
    summary: LocalizedText;
    confidence: number;
  };
  impactedAssets: AssetImpact[];
  timeline: TimelineItem[];
};
