import type {
  CoinPoolPayload,
  CoinTickerEntry,
  MarketDataSource,
} from "@/modules/agent-watch/types";
import {
  getCoinWFuturesInstrumentSet,
  normalizeCoinWFuturesSymbol,
  type CoinWFuturesInstrument,
  type CoinWFuturesInstrumentSet,
} from "@/lib/coinw/futuresInstruments";

export type CoinWResolutionPriceSource = Extract<
  MarketDataSource,
  "pool" | "coinw-futures-ticker" | "coinw-kline"
>;

export type CoinWResolutionPriceDiagnostic = "missingCoinWPrice";

export interface CoinWResolvedPrice {
  symbol: string;
  price: number;
  source: CoinWResolutionPriceSource;
  fetchedAt: string;
  coinwPair: string;
}

export interface CoinWMissingPrice {
  symbol: string;
  price: null;
  source: CoinWResolutionPriceDiagnostic;
  fetchedAt: string;
  coinwPair?: string;
  reason: "not_listed_on_coinw" | "coinw_price_unavailable";
}

export type CoinWPriceResolution = CoinWResolvedPrice | CoinWMissingPrice;

export interface ResolveCurrentPricesOptions {
  symbols: readonly string[];
  pool?: CoinPoolPayload | null;
  now?: number;
  fetcher?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  concurrency?: number;
  instruments?: CoinWFuturesInstrumentSet;
}

const COINW_FUTURES_PUBLIC_API_BASE_URL =
  process.env.COINW_FUTURES_API_BASE_URL || "https://api.coinw.com";
const COINW_PRICE_SOURCE_TIMEOUT_MS = 5000;
const COINW_KLINE_CONCURRENCY = 2;

export async function resolveCurrentPricesForOpenStrategies({
  symbols,
  pool = null,
  now = Date.now(),
  fetcher = fetch,
  baseUrl = COINW_FUTURES_PUBLIC_API_BASE_URL,
  timeoutMs = COINW_PRICE_SOURCE_TIMEOUT_MS,
  concurrency = COINW_KLINE_CONCURRENCY,
  instruments,
}: ResolveCurrentPricesOptions): Promise<Map<string, CoinWPriceResolution>> {
  const fetchedAt = new Date(now).toISOString();
  const normalizedSymbols = normalizeSymbols(symbols);
  const instrumentSet = instruments ?? (await getCoinWFuturesInstrumentSet(now));
  const poolPrices = poolPriceMap(pool, fetchedAt);
  const results = new Map<string, CoinWPriceResolution>();
  const tickerSymbols: string[] = [];

  for (const symbol of normalizedSymbols) {
    const instrument = instrumentSet.get(symbol);
    if (!instrument) {
      results.set(symbol, {
        symbol,
        price: null,
        source: "missingCoinWPrice",
        fetchedAt,
        reason: "not_listed_on_coinw",
      });
      continue;
    }

    const poolPrice = poolPrices.get(symbol);
    if (poolPrice) {
      results.set(symbol, poolPrice);
      continue;
    }

    tickerSymbols.push(symbol);
  }

  if (tickerSymbols.length > 0) {
    const tickerPrices = await fetchCoinWFuturesTickerPrices({
      symbols: tickerSymbols,
      fetcher,
      baseUrl,
      timeoutMs,
      fetchedAt,
      instruments: instrumentSet,
    }).catch(() => new Map<string, CoinWResolvedPrice>());

    for (const symbol of tickerSymbols) {
      const tickerPrice = tickerPrices.get(symbol);
      if (tickerPrice) {
        results.set(symbol, tickerPrice);
      }
    }
  }

  const klineSymbols = tickerSymbols.filter((symbol) => !results.has(symbol));
  if (klineSymbols.length > 0) {
    const klineResults = await mapWithConcurrency(klineSymbols, concurrency, async (symbol) => {
      const instrument = instrumentSet.get(symbol);
      if (!instrument) return null;
      return fetchCoinWFuturesKlinePrice({
        symbol,
        instrument,
        fetcher,
        baseUrl,
        timeoutMs,
        fetchedAt,
      }).catch(() => null);
    });

    for (const result of klineResults) {
      if (result) results.set(result.symbol, result);
    }
  }

  for (const symbol of tickerSymbols) {
    if (results.has(symbol)) continue;
    const instrument = instrumentSet.get(symbol);
    results.set(symbol, {
      symbol,
      price: null,
      source: "missingCoinWPrice",
      fetchedAt,
      ...(instrument?.coinwPair ? { coinwPair: instrument.coinwPair } : {}),
      reason: "coinw_price_unavailable",
    });
  }

  return results;
}

export function normalizeResolutionSymbols(symbols: readonly string[]) {
  return normalizeSymbols(symbols);
}

function normalizeSymbols(symbols: readonly string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => normalizeCoinWFuturesSymbol(symbol))
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );
}

function poolPriceMap(pool: CoinPoolPayload | null | undefined, fetchedAt: string) {
  const map = new Map<string, CoinWResolvedPrice>();
  if (!pool) return map;

  for (const item of [...pool.majors, ...pool.trending, ...pool.opportunity]) {
    const resolution = poolResolution(item, fetchedAt);
    if (resolution && !map.has(resolution.symbol)) map.set(resolution.symbol, resolution);
  }

  return map;
}

function poolResolution(item: CoinTickerEntry, fetchedAt: string): CoinWResolvedPrice | null {
  const symbol = normalizeCoinWFuturesSymbol(item.symbol);
  if (!symbol || item.execution?.executable !== true || !item.execution.coinwPair) return null;
  if (!Number.isFinite(item.price) || item.price <= 0) return null;
  return {
    symbol,
    price: item.price,
    source: "pool",
    fetchedAt,
    coinwPair: item.execution.coinwPair,
  };
}

async function fetchCoinWFuturesTickerPrices({
  symbols,
  fetcher,
  baseUrl,
  timeoutMs,
  fetchedAt,
  instruments,
}: {
  symbols: readonly string[];
  fetcher: typeof fetch;
  baseUrl: string;
  timeoutMs: number;
  fetchedAt: string;
  instruments: CoinWFuturesInstrumentSet;
}) {
  if (symbols.length === 0) return new Map<string, CoinWResolvedPrice>();
  const url = `${baseUrl.replace(/\/$/, "")}/v1/perpumPublic/ticker/list?symbols=${encodeURIComponent(
    symbols.join(","),
  )}`;
  const payload = await fetchJson(fetcher, url, timeoutMs);
  const rows = rowsFromPayload(payload);
  const map = new Map<string, CoinWResolvedPrice>();

  for (const row of rows) {
    const item = row as Record<string, unknown>;
    const symbol =
      normalizeCoinWFuturesSymbol(item.base_coin) ??
      normalizeCoinWFuturesSymbol(item.price_coin) ??
      normalizeCoinWFuturesSymbol(item.name);
    if (!symbol || !symbols.includes(symbol)) continue;
    const instrument = instruments.get(symbol);
    if (!instrument) continue;
    const price = firstPositiveNumber(item.last_price, item.fair_price, item.close, item.price);
    if (price === null) continue;
    map.set(symbol, {
      symbol,
      price,
      source: "coinw-futures-ticker",
      fetchedAt,
      coinwPair: instrument.coinwPair,
    });
  }

  return map;
}

async function fetchCoinWFuturesKlinePrice({
  symbol,
  instrument,
  fetcher,
  baseUrl,
  timeoutMs,
  fetchedAt,
}: {
  symbol: string;
  instrument: CoinWFuturesInstrument;
  fetcher: typeof fetch;
  baseUrl: string;
  timeoutMs: number;
  fetchedAt: string;
}) {
  const url = `${baseUrl.replace(
    /\/$/,
    "",
  )}/v1/perpumPublic/klines?currencyCode=${encodeURIComponent(
    symbol,
  )}&granularity=0&limit=2&klineType=0`;
  const payload = await fetchJson(fetcher, url, timeoutMs);
  const rows = rowsFromPayload(payload);
  const row = rows[rows.length - 1];
  const price = Array.isArray(row)
    ? firstPositiveNumber(row[4], row[2], row[1])
    : firstPositiveNumber((row as Record<string, unknown> | undefined)?.close);
  if (price === null) return null;
  return {
    symbol,
    price,
    source: "coinw-kline" as const,
    fetchedAt,
    coinwPair: instrument.coinwPair,
  };
}

async function fetchJson(fetcher: typeof fetch, url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`coinw price ${response.status}`);
    const payload = await response.json();
    const code = (payload as { code?: unknown }).code;
    if (code !== undefined && code !== 0) {
      throw new Error(`coinw price code ${String(code)}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function rowsFromPayload(payload: unknown): unknown[] {
  const source = payload as { data?: unknown; result?: unknown };
  const rows = source.data ?? source.result ?? payload;
  return Array.isArray(rows) ? rows : [];
}

function firstPositiveNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  const width = Math.max(1, Math.floor(concurrency));
  for (let index = 0; index < items.length; index += width) {
    const batch = items.slice(index, index + width);
    results.push(...(await Promise.all(batch.map(worker))));
  }
  return results;
}
