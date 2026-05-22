import type { CoinTickerEntry } from "@/modules/agent-watch/types";
import type { CoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";
import type { MarketTrigger } from "@/lib/watch/marketTriggers";

export const TRENDING_LIMITS = {
  minDisplay: 0,
  maxDisplay: 8,
} as const;

export function selectDynamicTrendingEntries({
  entries,
  triggers,
  futuresInstrumentSet,
}: {
  entries: readonly CoinTickerEntry[];
  triggers: readonly MarketTrigger[];
  futuresInstrumentSet: CoinWFuturesInstrumentSet;
}): CoinTickerEntry[] {
  const triggerScoreBySymbol = scoreTriggersBySymbol(triggers);
  const bySymbol = new Map<string, CoinTickerEntry>();

  for (const entry of entries) {
    const symbol = entry.symbol.trim().toUpperCase();
    if (!symbol || !triggerScoreBySymbol.has(symbol)) continue;
    if (!isCoinWFuturesSymbol(symbol, futuresInstrumentSet)) continue;
    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, { ...entry, symbol });
    }
  }

  return Array.from(bySymbol.values())
    .sort(
      (left, right) =>
        (triggerScoreBySymbol.get(right.symbol) ?? 0) -
          (triggerScoreBySymbol.get(left.symbol) ?? 0) || left.symbol.localeCompare(right.symbol),
    )
    .slice(TRENDING_LIMITS.minDisplay, TRENDING_LIMITS.maxDisplay);
}

function scoreTriggersBySymbol(triggers: readonly MarketTrigger[]) {
  const scores = new Map<string, number>();
  for (const trigger of triggers) {
    if (trigger.kind === "fallback_cron") continue;
    const symbol = trigger.symbol.trim().toUpperCase();
    if (!symbol) continue;
    scores.set(symbol, (scores.get(symbol) ?? 0) + trigger.signalStrength);
  }
  return scores;
}

function isCoinWFuturesSymbol(symbol: string, futuresInstrumentSet: CoinWFuturesInstrumentSet) {
  const normalized = symbol.trim().toUpperCase();
  return futuresInstrumentSet.has(normalized);
}
