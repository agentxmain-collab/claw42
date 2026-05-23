import type { NewsItem } from "@/lib/types";
import {
  SOCIAL_SIGNAL_CACHE_VERSION_PREFIX,
  SOCIAL_SIGNAL_WINDOW_MS,
  type SocialSignalObservation,
  type SocialSignalSnapshot,
} from "@/lib/social/socialSignalTypes";

function normalizeSymbol(symbol: string | undefined) {
  return symbol?.trim().replace(/^\$+/, "").toUpperCase() ?? "";
}

function sourceKey(item: NewsItem) {
  return item.sourceDomain?.trim().toLowerCase() || item.source.trim().toLowerCase() || "unknown";
}

function sentimentValue(item: NewsItem) {
  if (item.sentiment === "bullish") return 1;
  if (item.sentiment === "bearish") return -1;
  return 0;
}

function voteEngagement(item: NewsItem) {
  const positive = Math.max(0, item.votes?.positive ?? 0);
  const negative = Math.max(0, item.votes?.negative ?? 0);
  const important = Math.max(0, item.votes?.important ?? 0);
  return positive + negative + important * 2;
}

function cryptoPanicItems(items: NewsItem[], now: number) {
  const cutoff = now - SOCIAL_SIGNAL_WINDOW_MS;
  return items.filter((item) => {
    // Current NewsItem carries article source, not provider id. In this repo, votes are only
    // emitted by the CryptoPanic adapter, so votes are the provider-backed signal boundary.
    if (!item.votes) return false;
    return item.publishedAt >= cutoff && item.publishedAt <= now + 60_000;
  });
}

export function normalizeCryptoPanicSocialSignals(
  items: NewsItem[],
  now = Date.now(),
): SocialSignalSnapshot {
  const grouped = new Map<string, NewsItem[]>();

  for (const item of cryptoPanicItems(items, now)) {
    for (const rawSymbol of item.currencies) {
      const symbol = normalizeSymbol(rawSymbol);
      if (!symbol) continue;
      grouped.set(symbol, [...(grouped.get(symbol) ?? []), item]);
    }
  }

  const observedAt = new Date(now).toISOString();
  const observations: SocialSignalObservation[] = Array.from(grouped.entries()).map(
    ([symbol, symbolItems]) => {
      const engagement = symbolItems.reduce((sum, item) => sum + voteEngagement(item), 0);
      const sentimentSum = symbolItems.reduce((sum, item) => sum + sentimentValue(item), 0);
      const sources = new Set(symbolItems.map(sourceKey));
      const mentionCount = symbolItems.length;

      return {
        provider: "cryptopanic",
        candidateKey: symbol,
        symbol,
        observedAt,
        windowMs: SOCIAL_SIGNAL_WINDOW_MS,
        status: "ok",
        mentionCount,
        sentimentScore: mentionCount > 0 ? sentimentSum / mentionCount : 0,
        engagementScore: engagement,
        sourceCount: sources.size,
        reliability: Math.min(1, 0.35 + mentionCount * 0.15 + sources.size * 0.15),
      };
    },
  );

  return {
    provider: "cryptopanic",
    cacheVersion: `${SOCIAL_SIGNAL_CACHE_VERSION_PREFIX}:cryptopanic:${Math.floor(
      now / (5 * 60_000),
    )}`,
    observedAt,
    observations,
  };
}

export function socialSignalScore(observation: SocialSignalObservation) {
  if (observation.status !== "ok") return 0;
  const mention = Math.min(observation.mentionCount, 6) / 6;
  const engagement = Math.min(observation.engagementScore, 30) / 30;
  const sourceDiversity = Math.min(observation.sourceCount, 4) / 4;
  const sentimentIntensity = Math.min(Math.abs(observation.sentimentScore), 1);
  const normalized =
    mention * 0.35 + engagement * 0.3 + sourceDiversity * 0.2 + sentimentIntensity * 0.15;
  return Math.min(15, normalized * 15 * Math.max(0, Math.min(1, observation.reliability)));
}
