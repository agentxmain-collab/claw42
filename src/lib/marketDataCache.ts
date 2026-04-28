import fallbackTickerData from "@/modules/agent-watch/skills/fallback-tickers.json";
import type {
  CoinMarketContext,
  CoinSymbol,
  MarketCandle,
  MarketTickerPayload,
  TickerMap,
  TimeframeSignal,
} from "@/modules/agent-watch/types";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
let lastKnownTickers: MarketTickerPayload | null = null;

const TICKER_CACHE_KEY = "coingecko:ticker:v1";
const MARKET_CONTEXT_CACHE_KEY = "coinw:market-context:v1";
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=usd&include_24hr_change=true";
const COINW_PUBLIC_API_BASE_URL = process.env.COINW_PUBLIC_API_BASE_URL || "https://api.coinw.com";
const COINW_SYMBOLS: Array<Exclude<CoinSymbol, "USDT">> = ["BTC", "ETH", "SOL"];
const COINW_PERIODS = {
  m5: 300,
  m15: 900,
  h4: 14_400,
} as const;
const COINW_TARGET_CANDLES = 220;
const COINW_TIMEOUT_MS = 5000;

export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;

  const fresh = await fetcher();
  cache.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
  return fresh;
}

function fallbackTickers(): MarketTickerPayload {
  return {
    ts: Date.now(),
    tickers: fallbackTickerData.tickers as TickerMap,
    source: "fallback",
    isFallback: true,
    error: "ticker_unavailable",
  };
}

function normalizeCoinGeckoPayload(payload: unknown): TickerMap {
  const source = payload as Record<string, { usd?: number; usd_24h_change?: number }>;
  return {
    BTC: {
      price: Number(source.bitcoin?.usd ?? fallbackTickerData.tickers.BTC.price),
      change24h: Number(
        source.bitcoin?.usd_24h_change ?? fallbackTickerData.tickers.BTC.change24h,
      ),
    },
    ETH: {
      price: Number(source.ethereum?.usd ?? fallbackTickerData.tickers.ETH.price),
      change24h: Number(
        source.ethereum?.usd_24h_change ?? fallbackTickerData.tickers.ETH.change24h,
      ),
    },
    SOL: {
      price: Number(source.solana?.usd ?? fallbackTickerData.tickers.SOL.price),
      change24h: Number(
        source.solana?.usd_24h_change ?? fallbackTickerData.tickers.SOL.change24h,
      ),
    },
    USDT: {
      price: Number(source.tether?.usd ?? fallbackTickerData.tickers.USDT.price),
      change24h: Number(
        source.tether?.usd_24h_change ?? fallbackTickerData.tickers.USDT.change24h,
      ),
    },
  };
}

async function fetchCoinGeckoTickers(): Promise<MarketTickerPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const headers: HeadersInit = {};
    if (process.env.COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
    }

    const response = await fetch(COINGECKO_URL, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`coingecko ${response.status}`);

    const payload = await response.json();
    const fresh = {
      ts: Date.now(),
      tickers: normalizeCoinGeckoPayload(payload),
      source: "coingecko-ticker" as const,
    };
    lastKnownTickers = fresh;
    return fresh;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMarketTickers(): Promise<MarketTickerPayload> {
  try {
    return await getCached(TICKER_CACHE_KEY, 30_000, fetchCoinGeckoTickers);
  } catch (error) {
    console.warn("[claw42] ticker fallback", error instanceof Error ? error.message : error);
    if (lastKnownTickers) {
      return {
        ...lastKnownTickers,
        ts: Date.now(),
        isStale: true,
        error: "ticker_unavailable",
      };
    }
    return fallbackTickers();
  }
}

function toCoinWPair(symbol: Exclude<CoinSymbol, "USDT">): string {
  return `${symbol}_USDT`;
}

function parseNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseCoinWCandle(raw: unknown): MarketCandle | null {
  const item = raw as Record<string, unknown>;
  const timestamp =
    parseNumber(item.date) ??
    parseNumber(item.time) ??
    parseNumber(item.ts) ??
    parseNumber(item.id) ??
    parseNumber(item[0]);
  const open = parseNumber(item.open) ?? parseNumber(item[1]);
  const high = parseNumber(item.high) ?? parseNumber(item[2]);
  const low = parseNumber(item.low) ?? parseNumber(item[3]);
  const close = parseNumber(item.close) ?? parseNumber(item[4]);
  const volume = parseNumber(item.volume) ?? parseNumber(item.vol) ?? parseNumber(item[5]) ?? 0;

  if (timestamp === null || open === null || high === null || low === null || close === null) {
    return null;
  }

  return {
    timestamp: timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp,
    open,
    high,
    low,
    close,
    volume,
  };
}

function normalizeCoinWCandles(payload: unknown): Record<string, MarketCandle[]> {
  const result: Record<string, MarketCandle[]> = {};
  const source = payload as {
    data?: unknown;
  };
  const data = source.data ?? payload;

  if (Array.isArray(data)) {
    result.default = data.map(parseCoinWCandle).filter((item): item is MarketCandle => Boolean(item));
  } else if (data && typeof data === "object") {
    Object.entries(data as Record<string, unknown>).forEach(([pair, value]) => {
      if (!Array.isArray(value)) return;
      result[pair.toUpperCase()] = value
        .map(parseCoinWCandle)
        .filter((item): item is MarketCandle => Boolean(item));
    });
  }

  Object.keys(result).forEach((pair) => {
    result[pair] = result[pair].sort((a, b) => a.timestamp - b.timestamp);
  });

  return result;
}

async function fetchCoinWKlines(periodSec: number): Promise<Record<string, MarketCandle[]>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COINW_TIMEOUT_MS);
  const end = Date.now();
  const start = end - periodSec * COINW_TARGET_CANDLES * 1000;
  const params = new URLSearchParams({
    command: "returnChartData",
    currencyPair: COINW_SYMBOLS.map(toCoinWPair).join(","),
    period: String(periodSec),
    start: String(start),
    end: String(end),
  });

  try {
    const response = await fetch(`${COINW_PUBLIC_API_BASE_URL}/api/v1/public?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`coinw ${response.status}`);
    return normalizeCoinWCandles(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const multiplier = 2 / (period + 1);
  return values
    .slice(period)
    .reduce((current, value) => (value - current) * multiplier + current, seed);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildTimeframeSignal(candles: MarketCandle[] | undefined, periodSec: number): TimeframeSignal | null {
  if (!candles || candles.length < 2) return null;
  const relevant = candles.slice(-COINW_TARGET_CANDLES);
  const closes = relevant.map((item) => item.close);
  const latest = relevant[relevant.length - 1];
  const first = relevant[0];
  const recent = relevant.slice(-20);
  const recentVolumes = recent.slice(0, -1).map((item) => item.volume);
  const averageVolume = average(recentVolumes);
  const ema12 = ema(closes, 12);
  const ema13 = ema(closes, 13);
  const ema144 = ema(closes, 144);
  const ema169 = ema(closes, 169);
  const trend =
    ema12 !== null && ema13 !== null && latest.close > ema12 && ema12 > ema13
      ? "bullish"
      : ema12 !== null && ema13 !== null && latest.close < ema12 && ema12 < ema13
        ? "bearish"
        : "range";

  return {
    periodSec,
    candleCount: relevant.length,
    latestClose: latest.close,
    changePct: first.close === 0 ? 0 : ((latest.close - first.close) / first.close) * 100,
    high: Math.max(...relevant.map((item) => item.high)),
    low: Math.min(...relevant.map((item) => item.low)),
    support: Math.min(...recent.map((item) => item.low)),
    resistance: Math.max(...recent.map((item) => item.high)),
    volumeRatio: averageVolume && averageVolume > 0 ? latest.volume / averageVolume : null,
    ema12,
    ema13,
    ema144,
    ema169,
    trend,
  };
}

function candlesForPair(candlesByPair: Record<string, MarketCandle[]>, symbol: Exclude<CoinSymbol, "USDT">) {
  const pair = toCoinWPair(symbol);
  return candlesByPair[pair] ?? candlesByPair[pair.toLowerCase()] ?? candlesByPair.default;
}

async function fetchCoinWContext(): Promise<Partial<Record<CoinSymbol, CoinMarketContext>>> {
  const [m5, m15, h4] = await Promise.all([
    fetchCoinWKlines(COINW_PERIODS.m5),
    fetchCoinWKlines(COINW_PERIODS.m15),
    fetchCoinWKlines(COINW_PERIODS.h4),
  ]);

  return COINW_SYMBOLS.reduce<Partial<Record<CoinSymbol, CoinMarketContext>>>((acc, symbol) => {
    acc[symbol] = {
      pair: toCoinWPair(symbol),
      m5: buildTimeframeSignal(candlesForPair(m5, symbol), COINW_PERIODS.m5),
      m15: buildTimeframeSignal(candlesForPair(m15, symbol), COINW_PERIODS.m15),
      h4: buildTimeframeSignal(candlesForPair(h4, symbol), COINW_PERIODS.h4),
    };
    return acc;
  }, {});
}

function tickersFromCoinWContext(
  currentTickers: TickerMap,
  coinw: Partial<Record<CoinSymbol, CoinMarketContext>>,
): TickerMap {
  return {
    ...currentTickers,
    ...COINW_SYMBOLS.reduce<Partial<TickerMap>>((acc, symbol) => {
      const signal = coinw[symbol]?.m5 ?? coinw[symbol]?.m15 ?? coinw[symbol]?.h4;
      if (!signal) return acc;
      acc[symbol] = {
        price: signal.latestClose,
        change24h: currentTickers[symbol].change24h,
      };
      return acc;
    }, {}),
  };
}

export async function getMarketAnalysisContext(): Promise<MarketTickerPayload> {
  const tickerPayload = await getMarketTickers();

  try {
    const coinw = await getCached(MARKET_CONTEXT_CACHE_KEY, 60_000, fetchCoinWContext);
    const hasLiveSignals = COINW_SYMBOLS.some((symbol) => {
      const context = coinw[symbol];
      return Boolean(context?.m5 || context?.m15 || context?.h4);
    });

    if (!hasLiveSignals) throw new Error("coinw empty kline context");

    return {
      ...tickerPayload,
      source: "coinw-kline",
      tickers: tickersFromCoinWContext(tickerPayload.tickers, coinw),
      coinw,
      isFallback: false,
      isStale: false,
      error: undefined,
    };
  } catch (error) {
    console.warn("[claw42] coinw kline fallback", error instanceof Error ? error.message : error);
    return tickerPayload;
  }
}
