import fallbackTickerData from "@/modules/agent-watch/skills/fallback-tickers.json";
import type {
  CoinPoolPayload,
  CoinTickerEntry,
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
const TRENDING_CACHE_KEY = "coingecko:trending:v1";
const OPPORTUNITY_CACHE_KEY = "coingecko:opportunity:v1";
const TRENDING_TTL_MS = 5 * 60_000;
const OPPORTUNITY_TTL_MS = 5 * 60_000;
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=usd&include_24hr_change=true";
const COINGECKO_TRENDING_URL = "https://api.coingecko.com/api/v3/search/trending";
const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h";
const COINW_PUBLIC_API_BASE_URL = process.env.COINW_PUBLIC_API_BASE_URL || "https://api.coinw.com";
const MAJORS_SYMBOLS: CoinSymbol[] = ["BTC", "ETH", "SOL"];
const POOL_EXCLUDED_SYMBOLS = new Set<string>([...MAJORS_SYMBOLS, "USDT"]);
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

function coinGeckoHeaders(): HeadersInit {
  if (!process.env.COINGECKO_API_KEY) return {};
  return { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY };
}

function normalizeCoinGeckoPayload(payload: unknown): TickerMap {
  const source = payload as Record<string, { usd?: number; usd_24h_change?: number }>;
  return {
    BTC: {
      price: Number(source.bitcoin?.usd ?? fallbackTickerData.tickers.BTC.price),
      change24h: Number(source.bitcoin?.usd_24h_change ?? fallbackTickerData.tickers.BTC.change24h),
    },
    ETH: {
      price: Number(source.ethereum?.usd ?? fallbackTickerData.tickers.ETH.price),
      change24h: Number(
        source.ethereum?.usd_24h_change ?? fallbackTickerData.tickers.ETH.change24h,
      ),
    },
    SOL: {
      price: Number(source.solana?.usd ?? fallbackTickerData.tickers.SOL.price),
      change24h: Number(source.solana?.usd_24h_change ?? fallbackTickerData.tickers.SOL.change24h),
    },
    USDT: {
      price: Number(source.tether?.usd ?? fallbackTickerData.tickers.USDT.price),
      change24h: Number(source.tether?.usd_24h_change ?? fallbackTickerData.tickers.USDT.change24h),
    },
  };
}

async function fetchCoinGeckoTickers(): Promise<MarketTickerPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(COINGECKO_URL, {
      headers: coinGeckoHeaders(),
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

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: coinGeckoHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`coingecko ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizePoolEntry({
  symbol,
  name,
  price,
  change24h,
  category,
}: {
  symbol: string;
  name?: string;
  price: unknown;
  change24h: unknown;
  category: CoinTickerEntry["category"];
}): CoinTickerEntry | null {
  const normalizedPrice = Number(price);
  const normalizedChange = Number(change24h);
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol || !Number.isFinite(normalizedPrice)) return null;

  return {
    symbol: normalizedSymbol,
    name,
    price: normalizedPrice,
    change24h: Number.isFinite(normalizedChange) ? normalizedChange : 0,
    category,
  };
}

async function fetchTrendingPool(): Promise<CoinTickerEntry[]> {
  const payload = (await fetchWithTimeout(COINGECKO_TRENDING_URL)) as {
    coins?: Array<{ item?: { id?: string; symbol?: string; name?: string } }>;
  };
  const topCoins = (payload.coins ?? [])
    .map((item) => item.item)
    .filter((item): item is { id: string; symbol: string; name?: string } =>
      Boolean(item?.id && item.symbol),
    )
    .filter((item) => !POOL_EXCLUDED_SYMBOLS.has(item.symbol.toUpperCase()))
    .slice(0, 3);

  if (topCoins.length === 0) return [];

  const ids = topCoins.map((item) => item.id).join(",");
  const pricePayload = (await fetchWithTimeout(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      ids,
    )}&vs_currencies=usd&include_24hr_change=true`,
  )) as Record<string, { usd?: number; usd_24h_change?: number }>;

  return topCoins
    .map((item) =>
      normalizePoolEntry({
        symbol: item.symbol,
        name: item.name,
        price: pricePayload[item.id]?.usd,
        change24h: pricePayload[item.id]?.usd_24h_change,
        category: "trending",
      }),
    )
    .filter((item): item is CoinTickerEntry => Boolean(item));
}

async function fetchOpportunityPool(): Promise<CoinTickerEntry[]> {
  const payload = (await fetchWithTimeout(COINGECKO_MARKETS_URL)) as Array<{
    symbol?: string;
    name?: string;
    current_price?: number;
    price_change_percentage_24h?: number;
  }>;
  if (!Array.isArray(payload)) return [];

  const filtered = payload.filter((item) => {
    const symbol = item.symbol?.toUpperCase();
    return symbol && !POOL_EXCLUDED_SYMBOLS.has(symbol);
  });
  const sorted = [...filtered].sort(
    (a, b) =>
      Number(b.price_change_percentage_24h ?? 0) - Number(a.price_change_percentage_24h ?? 0),
  );
  const candidates = [...sorted.slice(0, 2), ...sorted.slice(-1)];
  const seen = new Set<string>();

  return candidates
    .map((item) =>
      normalizePoolEntry({
        symbol: item.symbol ?? "",
        name: item.name,
        price: item.current_price,
        change24h: item.price_change_percentage_24h,
        category: "opportunity",
      }),
    )
    .filter((item): item is CoinTickerEntry => {
      if (!item || seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    })
    .slice(0, 3);
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

function parseCoinWArrayResponse(payload: unknown): MarketCandle[] {
  const source = payload as {
    data?: unknown;
    result?: unknown;
  };
  const data = source.data ?? source.result ?? payload;
  const candles = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Object.values(data as Record<string, unknown>).find(Array.isArray)
      : undefined;

  if (!Array.isArray(candles)) return [];

  return candles
    .map(parseCoinWCandle)
    .filter((item): item is MarketCandle => Boolean(item))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchCoinWKlines(periodSec: number): Promise<Record<string, MarketCandle[]>> {
  const results = await Promise.all(
    COINW_SYMBOLS.map(async (symbol) => {
      const pair = toCoinWPair(symbol);
      const end = Date.now();
      const params = new URLSearchParams({
        command: "returnChartData",
        currencyPair: pair,
        period: String(periodSec),
        start: String(end - periodSec * COINW_TARGET_CANDLES * 1000),
        end: String(end),
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), COINW_TIMEOUT_MS);

      try {
        const response = await fetch(`${COINW_PUBLIC_API_BASE_URL}/api/v1/public?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`coinw ${pair} ${response.status}`);
        const data = await response.json();
        return [pair, parseCoinWArrayResponse(data)] as const;
      } catch (error) {
        console.warn(
          "[claw42] coinw pair fallback",
          error instanceof Error ? error.message : error,
        );
        return [pair, []] as const;
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return Object.fromEntries(results);
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

function buildTimeframeSignal(
  candles: MarketCandle[] | undefined,
  periodSec: number,
): TimeframeSignal | null {
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

function candlesForPair(
  candlesByPair: Record<string, MarketCandle[]>,
  symbol: Exclude<CoinSymbol, "USDT">,
) {
  const pair = toCoinWPair(symbol);
  return candlesByPair[pair] ?? candlesByPair[pair.toLowerCase()];
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

function majorsFromTickers(tickers: TickerMap): CoinTickerEntry[] {
  return MAJORS_SYMBOLS.map((symbol) => ({
    symbol,
    price: tickers[symbol].price,
    change24h: tickers[symbol].change24h,
    category: "majors",
  }));
}

export async function getCoinPool(): Promise<CoinPoolPayload> {
  const analysisContext = await getMarketAnalysisContext();

  const [trendingResult, opportunityResult] = await Promise.allSettled([
    getCached(TRENDING_CACHE_KEY, TRENDING_TTL_MS, fetchTrendingPool),
    getCached(OPPORTUNITY_CACHE_KEY, OPPORTUNITY_TTL_MS, fetchOpportunityPool),
  ]);

  if (trendingResult.status === "rejected") {
    console.warn(
      "[claw42] trending fallback",
      trendingResult.reason instanceof Error
        ? trendingResult.reason.message
        : trendingResult.reason,
    );
  }
  if (opportunityResult.status === "rejected") {
    console.warn(
      "[claw42] opportunity fallback",
      opportunityResult.reason instanceof Error
        ? opportunityResult.reason.message
        : opportunityResult.reason,
    );
  }

  return {
    ts: Date.now(),
    tickers: analysisContext.tickers,
    majors: majorsFromTickers(analysisContext.tickers),
    trending: trendingResult.status === "fulfilled" ? trendingResult.value : [],
    opportunity: opportunityResult.status === "fulfilled" ? opportunityResult.value : [],
    signals: analysisContext.coinw,
    source: analysisContext.source,
    isStale: analysisContext.isStale,
    isFallback: analysisContext.isFallback,
    error: analysisContext.error,
  };
}
