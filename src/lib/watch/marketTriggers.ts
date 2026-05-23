import type { NewsItem } from "@/lib/types";
import type { CoinPoolPayload, CoinTickerEntry } from "@/modules/agent-watch/types";

export type MarketTriggerKind =
  | "price_volatility"
  | "volume_anomaly"
  | "news_intensity"
  | "social_spike"
  | "fallback_cron";

export interface MarketTrigger {
  kind: MarketTriggerKind;
  symbol: string;
  signalStrength: number;
  triggeredAt: string;
  sourceCount: number;
}

export interface SocialSpikeSignal {
  symbol: string;
  score: number;
}

const PRICE_VOLATILITY_THRESHOLD_PCT = 5;
const VOLUME_TO_MARKET_CAP_THRESHOLD = 0.08;
const NEWS_INTENSITY_THRESHOLD = 2;
const SOCIAL_SPIKE_THRESHOLD = 60;

export function evaluateMarketTriggers({
  pool,
  newsItems = [],
  socialSignals = [],
  now = Date.now(),
  includeFallbackCron = false,
}: {
  pool?: CoinPoolPayload;
  newsItems?: readonly NewsItem[];
  socialSignals?: readonly SocialSpikeSignal[];
  now?: number;
  includeFallbackCron?: boolean;
}): MarketTrigger[] {
  const triggeredAt = new Date(now).toISOString();
  const triggers: MarketTrigger[] = [];
  const entries = marketEntries(pool);

  for (const entry of entries) {
    const changeAbs = Math.abs(entry.change24h);
    if (changeAbs >= PRICE_VOLATILITY_THRESHOLD_PCT) {
      triggers.push({
        kind: "price_volatility",
        symbol: entry.symbol,
        signalStrength: Math.round(changeAbs * 10),
        triggeredAt,
        sourceCount: 1,
      });
    }

    const volumeRatio = volumeToMarketCapRatio(entry);
    if (volumeRatio !== null && volumeRatio >= VOLUME_TO_MARKET_CAP_THRESHOLD) {
      triggers.push({
        kind: "volume_anomaly",
        symbol: entry.symbol,
        signalStrength: Math.round(volumeRatio * 1000),
        triggeredAt,
        sourceCount: 1,
      });
    }
  }

  const newsCounts = countNewsBySymbol(newsItems);
  for (const [symbol, count] of Array.from(newsCounts.entries())) {
    if (count < NEWS_INTENSITY_THRESHOLD) continue;
    triggers.push({
      kind: "news_intensity",
      symbol,
      signalStrength: count * 25,
      triggeredAt,
      sourceCount: count,
    });
  }

  for (const signal of socialSignals) {
    const symbol = signal.symbol.trim().toUpperCase();
    if (!symbol || signal.score < SOCIAL_SPIKE_THRESHOLD) continue;
    triggers.push({
      kind: "social_spike",
      symbol,
      signalStrength: Math.round(signal.score),
      triggeredAt,
      sourceCount: 1,
    });
  }

  if (includeFallbackCron) {
    for (const entry of pool?.majors ?? []) {
      triggers.push({
        kind: "fallback_cron",
        symbol: entry.symbol,
        signalStrength: 1,
        triggeredAt,
        sourceCount: 1,
      });
    }
  }

  return sortTriggers(dedupeTriggers(triggers));
}

function marketEntries(pool?: CoinPoolPayload): CoinTickerEntry[] {
  if (!pool) return [];
  return [...pool.majors, ...pool.trending, ...pool.opportunity];
}

function volumeToMarketCapRatio(entry: CoinTickerEntry) {
  if (!entry.marketCapUsd || !entry.totalVolumeUsd24h || entry.marketCapUsd <= 0) return null;
  return entry.totalVolumeUsd24h / entry.marketCapUsd;
}

function countNewsBySymbol(newsItems: readonly NewsItem[]) {
  const counts = new Map<string, number>();
  for (const item of newsItems) {
    for (const currency of item.currencies) {
      const symbol = currency.trim().toUpperCase();
      if (!symbol) continue;
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
  }
  return counts;
}

function dedupeTriggers(triggers: readonly MarketTrigger[]) {
  const byKey = new Map<string, MarketTrigger>();
  for (const trigger of triggers) {
    const key = `${trigger.kind}:${trigger.symbol}`;
    const current = byKey.get(key);
    if (!current || trigger.signalStrength > current.signalStrength) {
      byKey.set(key, trigger);
    }
  }
  return Array.from(byKey.values());
}

function sortTriggers(triggers: readonly MarketTrigger[]) {
  return [...triggers].sort(
    (left, right) =>
      right.signalStrength - left.signalStrength ||
      left.kind.localeCompare(right.kind) ||
      left.symbol.localeCompare(right.symbol),
  );
}
