import type { PriceSnapshot } from "@/types/signal";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

type CoinMapping = {
  id: string;
  symbol: string;
};

type CoinGeckoPriceOptions = {
  fetcher?: Fetcher;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  coins?: CoinMapping[];
  includeVolumeChange24h?: boolean;
};

const defaultBaseUrl = "https://api.coingecko.com";
const defaultTimeoutMs = 8_000;
const defaultCoins: CoinMapping[] = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" }
];

export async function fetchCoinGeckoPriceSnapshots(options: CoinGeckoPriceOptions = {}): Promise<PriceSnapshot[]> {
  const coins = options.coins ?? defaultCoins;
  const url = new URL("/api/v3/simple/price", options.baseUrl ?? defaultBaseUrl);
  url.searchParams.set("ids", coins.map((coin) => coin.id).join(","));
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("include_24hr_change", "true");
  url.searchParams.set("include_24hr_vol", "true");
  url.searchParams.set("include_last_updated_at", "true");

  const response = await fetchWithTimeout(options.fetcher ?? fetch, url, options.timeoutMs ?? defaultTimeoutMs, {
    headers: options.apiKey ? { "x-cg-pro-api-key": options.apiKey } : undefined
  });
  const json = await parseJsonResponse(response);
  if (!response.ok) throw new Error(`price source failed with ${response.status}`);
  if (!isRecord(json)) return [];

  const volumeChanges = options.includeVolumeChange24h === false
    ? new Map<string, number>()
    : await fetchVolumeChanges(coins, options);

  return coins
    .map((coin) => toPriceSnapshot(coin, json[coin.id], volumeChanges.get(coin.id) ?? 0))
    .filter((snapshot): snapshot is PriceSnapshot => snapshot !== null);
}

async function fetchVolumeChanges(coins: CoinMapping[], options: CoinGeckoPriceOptions) {
  const entries = await Promise.all(coins.map(async (coin) => {
    try {
      const url = new URL(`/api/v3/coins/${encodeURIComponent(coin.id)}/market_chart`, options.baseUrl ?? defaultBaseUrl);
      url.searchParams.set("vs_currency", "usd");
      url.searchParams.set("days", "2");
      const response = await fetchWithTimeout(options.fetcher ?? fetch, url, options.timeoutMs ?? defaultTimeoutMs, {
        headers: options.apiKey ? { "x-cg-pro-api-key": options.apiKey } : undefined
      });
      if (!response.ok) return [coin.id, 0] as const;
      return [coin.id, calculateVolumeChange24h(await parseJsonResponse(response))] as const;
    } catch {
      return [coin.id, 0] as const;
    }
  }));

  return new Map(entries);
}

async function fetchWithTimeout(fetcher: Fetcher, url: URL, timeoutMs: number, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

function toPriceSnapshot(coin: CoinMapping, value: unknown, volumeChange24h: number): PriceSnapshot | null {
  if (!isRecord(value)) return null;
  const price = toNumber(value.usd);
  if (price === null) return null;

  const lastUpdatedAt = toNumber(value.last_updated_at);
  return {
    symbol: coin.symbol,
    price,
    change24h: toNumber(value.usd_24h_change) ?? 0,
    volumeChange24h,
    source: "coingecko",
    updatedAt: lastUpdatedAt ? new Date(lastUpdatedAt * 1000).toISOString() : new Date().toISOString()
  };
}

function calculateVolumeChange24h(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.total_volumes) || value.total_volumes.length < 2) return 0;
  const latest = volumePointValue(value.total_volumes[value.total_volumes.length - 1]);
  const previous = volumePointValue(value.total_volumes[value.total_volumes.length - 2]);
  if (latest === null || previous === null || previous <= 0) return 0;
  return Math.round(((latest - previous) / previous) * 10_000) / 100;
}

function volumePointValue(value: unknown) {
  if (!Array.isArray(value)) return null;
  return toNumber(value[1]);
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
