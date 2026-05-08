import type { MacroItem } from "@/types/calendar";
import type { MarketDirection, Severity } from "@/types/common";
import type { NewsItem, TimelineItem } from "@/types/news";
import type { EventStatus, EventType, EvidencePiece, PriceSnapshot, SignalTrack } from "@/types/signal";

export type RawCandidate = {
  id: string;
  title: NewsItem["title"];
  summary: NewsItem["summary"];
  fullSummary: NewsItem["fullSummary"];
  source: string;
  publishedAt: string;
  eventType: EventType;
  eventStatus: EventStatus;
  primaryAsset: string;
  relatedAssets: Array<{
    symbol: string;
    direction: MarketDirection;
    severity: Severity;
    note: NewsItem["summary"];
  }>;
  tracks: SignalTrack[];
  tradingPairs: string[];
  projects: string[];
  campaignTags: string[];
  timeline: TimelineItem[];
  evidence: EvidencePiece[];
  marketSnapshot: PriceSnapshot | null;
  macroItem: MacroItem | null;
  direction: MarketDirection | null;
};

export type RuleEvaluation = {
  name: string;
  score: number;
  triggered: boolean;
};
