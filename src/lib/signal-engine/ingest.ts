import { calendarItems, newsItems, priceSnapshots } from "@/lib/data/mock-db";
import { loadSignalDataSources } from "@/lib/data-sources";
import type { MacroItem } from "@/types/calendar";
import type { Severity } from "@/types/common";
import type { NewsItem } from "@/types/news";
import type { EventType, EvidencePiece, PriceSnapshot, SignalTrack } from "@/types/signal";
import type { RawCandidate } from "@/lib/signal-engine/types";

const credibleSources = new Set(["CoinW Research", "Policy Desk", "Onchain Desk"]);

export function isCredibleSource(source: string) {
  return credibleSources.has(source);
}

export function getPriceSnapshot(symbol: string) {
  return (
    priceSnapshots.find((snapshot) => snapshot.symbol.toUpperCase() === symbol.toUpperCase()) ??
    null
  );
}

type IngestOptions = {
  newsItems?: NewsItem[];
  priceSnapshots?: PriceSnapshot[];
  calendarItems?: MacroItem[];
};

export function ingestCandidates(options: IngestOptions = {}): RawCandidate[] {
  const sourceNewsItems = options.newsItems ?? newsItems;
  const sourcePriceSnapshots = options.priceSnapshots ?? priceSnapshots;
  const sourceCalendarItems = options.calendarItems ?? calendarItems;
  return [
    ...sourceNewsItems.map((item) => newsToCandidate(item, sourcePriceSnapshots)),
    ...sourceCalendarItems.filter((item) => item.impact === "high").map(calendarToCandidate),
  ];
}

export async function ingestCandidatesAsync(): Promise<RawCandidate[]> {
  const data = await loadSignalDataSources();
  return ingestCandidates({
    newsItems: data.newsItems,
    priceSnapshots: data.priceSnapshots,
    calendarItems: data.mode === "live" ? [] : calendarItems,
  });
}

function newsToCandidate(item: NewsItem, sourcePriceSnapshots: PriceSnapshot[]): RawCandidate {
  const primaryAsset = item.impactedAssets[0]?.symbol ?? inferPrimaryAsset(item);
  const marketSnapshot = getPriceSnapshotFrom(sourcePriceSnapshots, primaryAsset);
  const eventType = inferEventType(item);
  const relatedAssets = item.impactedAssets.map((asset) => ({
    symbol: asset.symbol,
    direction: asset.direction,
    severity: asset.severity,
    note: asset.note,
  }));

  return {
    id: `sig-${item.id}`,
    title: item.title,
    summary: item.summary,
    fullSummary: item.fullSummary,
    source: item.source,
    publishedAt: item.publishedAt,
    eventType,
    eventStatus: "confirmed",
    primaryAsset,
    relatedAssets,
    tracks: inferTracks(
      eventType,
      relatedAssets.map((asset) => asset.symbol),
    ),
    tradingPairs: relatedAssets.map((asset) => `${asset.symbol}/USDT`),
    projects: relatedAssets
      .filter((asset) => !["BTC", "ETH", "SOL", "USDC"].includes(asset.symbol))
      .map((asset) => asset.symbol),
    campaignTags: inferCampaignTags(eventType, primaryAsset),
    timeline: item.timeline,
    evidence: buildEvidence(item, marketSnapshot, eventType),
    marketSnapshot,
    macroItem: null,
    direction: item.marketDirection,
  };
}

function getPriceSnapshotFrom(sourcePriceSnapshots: PriceSnapshot[], symbol: string) {
  return (
    sourcePriceSnapshots.find(
      (snapshot) => snapshot.symbol.toUpperCase() === symbol.toUpperCase(),
    ) ?? null
  );
}

function calendarToCandidate(item: MacroItem): RawCandidate {
  const title = {
    zh: `${item.name.zh}临近，市场等待宏观确认`,
    en: `${item.name.en} approaches as markets await macro confirmation`,
  };
  const summary = {
    zh: `${item.name.zh}将影响美元、利率预期与风险资产定价。`,
    en: `${item.name.en} may influence the dollar, rate expectations, and risk-asset pricing.`,
  };

  return {
    id: `sig-macro-${item.id}`,
    title,
    summary,
    fullSummary: summary,
    source: "Macro Calendar",
    publishedAt: item.datetime,
    eventType: "macro",
    eventStatus: "developing",
    primaryAsset: "MARKET",
    relatedAssets: [],
    tracks: ["btc_eth"],
    tradingPairs: [],
    projects: [],
    campaignTags: ["macro"],
    timeline: [
      {
        id: `macro-${item.id}`,
        datetime: item.datetime,
        title: item.name,
        detail: {
          zh: `预期值 ${item.forecast}，实际值 ${item.actual}。`,
          en: `Forecast ${item.forecast}, actual ${item.actual}.`,
        },
      },
    ],
    evidence: [
      {
        kind: "macro",
        source: "Macro Calendar",
        excerpt: summary,
        capturedAt: item.datetime,
      },
    ],
    marketSnapshot: null,
    macroItem: item,
    direction: null,
  };
}

function buildEvidence(
  item: NewsItem,
  marketSnapshot: ReturnType<typeof getPriceSnapshot>,
  eventType: EventType,
): EvidencePiece[] {
  const pieces: EvidencePiece[] = [
    {
      kind: "news",
      source: item.source,
      excerpt: item.summary,
      capturedAt: item.publishedAt,
    },
  ];

  if (marketSnapshot && Math.abs(marketSnapshot.change24h) >= 3) {
    pieces.push({
      kind: "market",
      source: marketSnapshot.source,
      excerpt: {
        zh: `${marketSnapshot.symbol} 24h 变化 ${marketSnapshot.change24h}%，成交量变化 ${marketSnapshot.volumeChange24h}%。`,
        en: `${marketSnapshot.symbol} changed ${marketSnapshot.change24h}% over 24h with volume change of ${marketSnapshot.volumeChange24h}%.`,
      },
      capturedAt: marketSnapshot.updatedAt,
    });
  }

  if (eventType === "etf" || eventType === "macro") {
    const macro = calendarItems.find((calendarItem) => calendarItem.impact === "high");
    if (macro) {
      pieces.push({
        kind: "macro",
        source: "Macro Calendar",
        excerpt: {
          zh: `${macro.name.zh} 是当前风险资产定价的重要背景。`,
          en: `${macro.name.en} is an important backdrop for risk-asset pricing.`,
        },
        capturedAt: macro.datetime,
      });
    }
  }

  return pieces;
}

function inferEventType(item: NewsItem): EventType {
  const text = `${item.id} ${item.title.zh} ${item.title.en}`.toLowerCase();
  if (text.includes("etf")) return "etf";
  if (text.includes("监管") || text.includes("policy") || text.includes("bill"))
    return "regulation";
  if (text.includes("升级") || text.includes("upgrade")) return "project";
  if (text.includes("矿工") || text.includes("miner")) return "onchain";
  return "narrative";
}

function inferPrimaryAsset(item: NewsItem) {
  const text = `${item.title.zh} ${item.title.en}`.toUpperCase();
  for (const symbol of ["BTC", "ETH", "SOL", "USDC", "RWA"]) {
    if (text.includes(symbol)) return symbol;
  }
  return "MARKET";
}

function inferTracks(eventType: EventType, assets: string[]): SignalTrack[] {
  const tracks = new Set<SignalTrack>();
  if (assets.some((asset) => asset === "BTC" || asset === "ETH")) tracks.add("btc_eth");
  if (assets.includes("SOL")) tracks.add("altcoin");
  if (assets.includes("OP")) tracks.add("l2");
  if (assets.includes("USDC")) tracks.add("stablecoin");
  if (assets.includes("RWA") || eventType === "regulation") tracks.add("rwa");
  if (eventType === "onchain") tracks.add("infrastructure");
  if (tracks.size === 0) tracks.add("btc_eth");
  return Array.from(tracks);
}

function inferCampaignTags(eventType: EventType, primaryAsset: string) {
  return [eventType, primaryAsset.toLowerCase()].filter(Boolean);
}

export function severityToImpact(severity: Severity) {
  return severity === "high" ? "high" : severity === "medium" ? "medium" : "low";
}
