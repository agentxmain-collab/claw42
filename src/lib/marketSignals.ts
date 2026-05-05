import { getCoinPool } from "@/lib/marketDataCache";
import { pushSignals } from "@/lib/signalBuffer";
import type {
  CoinMarketContext,
  CoinPoolPayload,
  CoinTickerEntry,
  SignalRecord,
  SignalSeverity,
} from "@/modules/agent-watch/types";

const THRESHOLDS = {
  VOLUME_SPIKE_RATIO: 1.8,
  NEAR_LEVEL_PCT: 0.005,
  RANGE_CHANGE_PCT: 10,
} as const;

let lastPoolForSignals: CoinPoolPayload | null = null;
let signalGenerationInFlight: Promise<CoinPoolPayload | null> | null = null;

function signalId(ts: number, symbol: string, type: SignalRecord["type"], suffix = ""): string {
  const minuteBucket = Math.floor(ts / 60_000);
  return `${minuteBucket}-${symbol}-${type}${suffix ? `-${suffix}` : ""}`;
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: value < 1 ? 6 : 2 })}`;
}

function severityForChange(change24h: number): SignalSeverity {
  return Math.abs(change24h) >= 20 ? "alert" : "watch";
}

function signalForRangeChange(coin: CoinTickerEntry, now: number): SignalRecord | null {
  if (!(Math.abs(coin.change24h) >= THRESHOLDS.RANGE_CHANGE_PCT && coin.category !== "majors")) {
    return null;
  }

  return {
    id: signalId(now, coin.symbol, "range_change"),
    ts: now,
    symbol: coin.symbol,
    type: "range_change",
    severity: severityForChange(coin.change24h),
    payload: {
      change24h: coin.change24h,
      description: `${coin.symbol} 24h ${coin.change24h >= 0 ? "+" : ""}${coin.change24h.toFixed(
        1,
      )}%（机会区异动）`,
    },
  };
}

function klineContextForCoin(
  pool: CoinPoolPayload,
  coin: CoinTickerEntry,
): CoinMarketContext | null {
  if (coin.category !== "majors") return null;
  return pool.signals?.[coin.symbol as keyof typeof pool.signals] ?? null;
}

function pushKlineSignals(
  signals: SignalRecord[],
  coin: CoinTickerEntry,
  context: CoinMarketContext,
  lastContext: CoinMarketContext | null,
  now: number,
) {
  const m5 = context.m5;
  if (!m5) return;

  if (m5.volumeRatio && m5.volumeRatio >= THRESHOLDS.VOLUME_SPIKE_RATIO) {
    signals.push({
      id: signalId(now, coin.symbol, "volume_spike", "m5"),
      ts: now,
      symbol: coin.symbol,
      type: "volume_spike",
      severity: m5.volumeRatio >= 3 ? "alert" : "watch",
      payload: {
        volumeRatio: m5.volumeRatio,
        description: `${coin.symbol} 5m 放量 ${m5.volumeRatio.toFixed(1)}x`,
      },
    });
  }

  const distHigh = (m5.high - m5.latestClose) / m5.latestClose;
  const distLow = (m5.latestClose - m5.low) / m5.latestClose;
  if (distHigh >= 0 && distHigh <= THRESHOLDS.NEAR_LEVEL_PCT) {
    signals.push({
      id: signalId(now, coin.symbol, "near_high"),
      ts: now,
      symbol: coin.symbol,
      type: "near_high",
      severity: distHigh <= 0.005 ? "alert" : "watch",
      payload: {
        priceLevel: m5.high,
        distancePct: distHigh * 100,
        description: `${coin.symbol} 距前高 ${(distHigh * 100).toFixed(2)}%，正在测压`,
      },
    });
  }

  if (distLow >= 0 && distLow <= THRESHOLDS.NEAR_LEVEL_PCT) {
    signals.push({
      id: signalId(now, coin.symbol, "near_low"),
      ts: now,
      symbol: coin.symbol,
      type: "near_low",
      severity: distLow <= 0.005 ? "alert" : "watch",
      payload: {
        priceLevel: m5.low,
        distancePct: distLow * 100,
        description: `${coin.symbol} 距前低 ${(distLow * 100).toFixed(2)}%，下方止损单密集`,
      },
    });
  }

  const lastM5 = lastContext?.m5;
  if (!lastM5) return;

  if (m5.latestClose > lastM5.high) {
    signals.push({
      id: signalId(now, coin.symbol, "breakout", "up"),
      ts: now,
      symbol: coin.symbol,
      type: "breakout",
      severity: "alert",
      payload: {
        priceLevel: lastM5.high,
        description: `${coin.symbol} 突破前高 ${formatPrice(lastM5.high)}`,
      },
    });
  } else if (m5.latestClose < lastM5.low) {
    signals.push({
      id: signalId(now, coin.symbol, "breakout", "down"),
      ts: now,
      symbol: coin.symbol,
      type: "breakout",
      severity: "alert",
      payload: {
        priceLevel: lastM5.low,
        description: `${coin.symbol} 跌破前低 ${formatPrice(lastM5.low)}`,
      },
    });
  }

  if (lastM5.trend !== m5.trend && m5.trend === "bullish") {
    signals.push({
      id: signalId(now, coin.symbol, "ema_cross", "up"),
      ts: now,
      symbol: coin.symbol,
      type: "ema_cross",
      severity: "watch",
      payload: {
        emaState: "golden_cross",
        description: `${coin.symbol} 5m EMA 金叉`,
      },
    });
  } else if (lastM5.trend !== m5.trend && m5.trend === "bearish") {
    signals.push({
      id: signalId(now, coin.symbol, "ema_cross", "down"),
      ts: now,
      symbol: coin.symbol,
      type: "ema_cross",
      severity: "watch",
      payload: {
        emaState: "dead_cross",
        description: `${coin.symbol} 5m EMA 死叉`,
      },
    });
  }
}

export function generateSignals(
  pool: CoinPoolPayload,
  lastPool: CoinPoolPayload | null,
): SignalRecord[] {
  const signals: SignalRecord[] = [];
  const now = Date.now();
  const allCoins = [...pool.majors, ...pool.trending, ...pool.opportunity];

  for (const coin of allCoins) {
    const rangeSignal = signalForRangeChange(coin, now);
    if (rangeSignal) signals.push(rangeSignal);

    const context = klineContextForCoin(pool, coin);
    if (!context) continue;

    const lastContext = lastPool ? klineContextForCoin(lastPool, coin) : null;
    pushKlineSignals(signals, coin, context, lastContext, now);
  }

  return signals;
}

export async function triggerSignalGeneration(): Promise<CoinPoolPayload | null> {
  if (signalGenerationInFlight) return signalGenerationInFlight;

  signalGenerationInFlight = (async () => {
    try {
      const pool = await getCoinPool();
      const records = generateSignals(pool, lastPoolForSignals);
      pushSignals(records);
      lastPoolForSignals = pool;
      return pool;
    } catch (error) {
      console.warn(
        "[claw42] signal generation failed",
        error instanceof Error ? error.message : error,
      );
      return null;
    } finally {
      signalGenerationInFlight = null;
    }
  })();

  return signalGenerationInFlight;
}
