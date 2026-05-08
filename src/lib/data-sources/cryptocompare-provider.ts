import type { PriceSnapshot } from "@/types/signal";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

type CryptoCompareOptions = {
  fetcher?: Fetcher;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  symbols?: string[];
};

const defaultBaseUrl = "https://min-api.cryptocompare.com";
const defaultTimeoutMs = 8_000;
const defaultSymbols = ["BTC", "ETH", "SOL"];

export async function fetchCryptoComparePriceSnapshots(
  options: CryptoCompareOptions = {},
): Promise<PriceSnapshot[]> {
  const symbols = options.symbols ?? defaultSymbols;
  const url = new URL("/data/pricemultifull", options.baseUrl ?? defaultBaseUrl);
  url.searchParams.set("fsyms", symbols.join(","));
  url.searchParams.set("tsyms", "USD");
  if (options.apiKey) url.searchParams.set("api_key", options.apiKey);

  const response = await fetchWithTimeout(
    options.fetcher ?? fetch,
    url,
    options.timeoutMs ?? defaultTimeoutMs,
  );
  const json = await parseJsonResponse(response);
  if (!response.ok) throw new Error(`cryptocompare price source failed with ${response.status}`);
  if (!isRecord(json)) return [];
  const raw = json.RAW;
  if (!isRecord(raw)) return [];

  return symbols
    .map((symbol) => toPriceSnapshot(symbol, raw))
    .filter((snapshot): snapshot is PriceSnapshot => snapshot !== null);
}

async function fetchWithTimeout(fetcher: Fetcher, url: URL, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

function toPriceSnapshot(symbol: string, raw: Record<string, unknown>): PriceSnapshot | null {
  const asset = raw[symbol];
  if (!isRecord(asset) || !isRecord(asset.USD)) return null;
  const price = toNumber(asset.USD.PRICE);
  if (price === null) return null;

  const lastUpdate = toNumber(asset.USD.LASTUPDATE);
  return {
    symbol,
    price,
    change24h: toNumber(asset.USD.CHANGEPCT24HOUR) ?? 0,
    volumeChange24h: 0,
    source: "cryptocompare",
    updatedAt: lastUpdate ? new Date(lastUpdate * 1000).toISOString() : new Date().toISOString(),
  };
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
