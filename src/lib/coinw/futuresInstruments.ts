import type { CoinTickerEntry } from "@/modules/agent-watch/types";

export interface CoinWFuturesInstrument {
  symbol: string;
  coinwPair: string;
  instrumentId?: string;
  status?: string;
  minSize?: number;
  oneLotSize?: number;
  pricePrecision?: number;
  maxLeverage?: number;
  leverage?: number[];
}

export type CoinWFuturesInstrumentSet = ReadonlyMap<string, CoinWFuturesInstrument>;

const COINW_FUTURES_INSTRUMENTS_CACHE_KEY = "coinw:futures-instruments:v1";
const COINW_FUTURES_INSTRUMENTS_TTL_MS = 10 * 60_000;
const COINW_FUTURES_API_BASE_URL =
  process.env.COINW_FUTURES_API_BASE_URL || "https://api.coinw.com";
const COINW_FUTURES_TIMEOUT_MS = 5000;

const cache = new Map<string, { expiresAt: number; value: CoinWFuturesInstrumentSet }>();

export const COINW_FUTURES_STATIC_FALLBACK: CoinWFuturesInstrument[] = [
  { symbol: "BTC", coinwPair: "BTC_USDT", status: "fallback" },
  { symbol: "ETH", coinwPair: "ETH_USDT", status: "fallback" },
  { symbol: "SOL", coinwPair: "SOL_USDT", status: "fallback" },
  { symbol: "HYPE", coinwPair: "HYPE_USDT", status: "fallback" },
  { symbol: "BILL", coinwPair: "BILL_USDT", status: "fallback" },
];

export function normalizeCoinWFuturesSymbol(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/^\$+/, "")
    .replace(/_?USDT$/i, "")
    .toUpperCase();
  return normalized && /^[A-Z0-9]{2,16}$/.test(normalized) ? normalized : null;
}

function normalizeQuote(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function parseNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeLeverage(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const leverage = value.map(parseNumber).filter((item): item is number => item !== undefined);
  return leverage.length > 0 ? leverage : undefined;
}

function rawRows(payload: unknown): unknown[] {
  const source = payload as { data?: unknown; result?: unknown };
  const rows = source.data ?? source.result ?? payload;
  return Array.isArray(rows) ? rows : [];
}

function normalizeRow(row: unknown): CoinWFuturesInstrument | null {
  const item = row as Record<string, unknown>;
  const symbol =
    normalizeCoinWFuturesSymbol(item.base) ??
    normalizeCoinWFuturesSymbol(item.name) ??
    normalizeCoinWFuturesSymbol(item.symbol);
  const quote = normalizeQuote(item.quote);
  const status = typeof item.status === "string" ? item.status.trim().toLowerCase() : undefined;

  if (!symbol || quote !== "USDT") return null;
  if (status && status !== "online") return null;

  return {
    symbol,
    coinwPair: `${symbol}_USDT`,
    ...(item.id !== undefined ? { instrumentId: String(item.id) } : {}),
    ...(status ? { status } : {}),
    ...(parseNumber(item.minSize) !== undefined ? { minSize: parseNumber(item.minSize) } : {}),
    ...(parseNumber(item.oneLotSize) !== undefined
      ? { oneLotSize: parseNumber(item.oneLotSize) }
      : {}),
    ...(parseNumber(item.pricePrecision) !== undefined
      ? { pricePrecision: parseNumber(item.pricePrecision) }
      : {}),
    ...(parseNumber(item.maxLeverage) !== undefined
      ? { maxLeverage: parseNumber(item.maxLeverage) }
      : {}),
    ...(normalizeLeverage(item.leverage) ? { leverage: normalizeLeverage(item.leverage) } : {}),
  };
}

export function normalizeCoinWFuturesInstruments(payload: unknown): CoinWFuturesInstrument[] {
  const instruments = rawRows(payload)
    .map(normalizeRow)
    .filter((item): item is CoinWFuturesInstrument => Boolean(item));
  return Array.from(new Map(instruments.map((item) => [item.symbol, item])).values()).sort(
    (left, right) => left.symbol.localeCompare(right.symbol),
  );
}

export function buildCoinWFuturesInstrumentSet(
  instruments: readonly CoinWFuturesInstrument[],
): CoinWFuturesInstrumentSet {
  return new Map(instruments.map((instrument) => [instrument.symbol, instrument]));
}

export function staticCoinWFuturesInstrumentSet(): CoinWFuturesInstrumentSet {
  return buildCoinWFuturesInstrumentSet(COINW_FUTURES_STATIC_FALLBACK);
}

export async function fetchCoinWFuturesInstruments({
  fetcher = fetch,
  baseUrl = COINW_FUTURES_API_BASE_URL,
}: {
  fetcher?: typeof fetch;
  baseUrl?: string;
} = {}): Promise<CoinWFuturesInstrument[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COINW_FUTURES_TIMEOUT_MS);

  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/v1/perpum/instruments`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`coinw futures instruments ${response.status}`);
    return normalizeCoinWFuturesInstruments(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function getCoinWFuturesInstrumentSet(now = Date.now()) {
  const cached = cache.get(COINW_FUTURES_INSTRUMENTS_CACHE_KEY);
  if (cached && cached.expiresAt > now) return cached.value;

  let instruments: CoinWFuturesInstrument[];
  try {
    instruments = await fetchCoinWFuturesInstruments();
    if (instruments.length === 0) throw new Error("coinw futures instruments empty");
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[claw42] coinw futures instrument fallback",
        error instanceof Error ? error.message : error,
      );
    }
    instruments = COINW_FUTURES_STATIC_FALLBACK;
  }

  const value = buildCoinWFuturesInstrumentSet(instruments);
  cache.set(COINW_FUTURES_INSTRUMENTS_CACHE_KEY, {
    value,
    expiresAt: now + COINW_FUTURES_INSTRUMENTS_TTL_MS,
  });
  return value;
}

export function filterCoinWFuturesPoolEntries(
  entries: readonly CoinTickerEntry[],
  instruments: CoinWFuturesInstrumentSet,
): CoinTickerEntry[] {
  return entries.flatMap((entry) => {
    const symbol = normalizeCoinWFuturesSymbol(entry.symbol);
    if (!symbol) return [];
    const instrument = instruments.get(symbol);
    if (!instrument) return [];
    return [
      {
        ...entry,
        symbol,
        execution: {
          executable: true,
          coinwPair: instrument.coinwPair,
          watchOnly: false,
        },
      },
    ];
  });
}
