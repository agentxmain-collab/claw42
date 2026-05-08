import {
  newsItems as mockNewsItems,
  priceSnapshots as mockPriceSnapshots,
} from "@/lib/data/mock-db";
import { fetchCryptoComparePriceSnapshots } from "@/lib/data-sources/cryptocompare-provider";
import {
  isDataSourceInCooldown,
  recordDataSourceError,
  recordDataSourceFallback,
  recordDataSourceSuccess,
} from "@/lib/data-sources/health";
import { fetchRssNewsItems } from "@/lib/data-sources/news-provider";
import { getNewsTranslatorFromEnv } from "@/lib/data-sources/news-translator";
import { fetchCoinGeckoPriceSnapshots } from "@/lib/data-sources/price-provider";
import { appendJsonLine } from "@/lib/storage/jsonl-writer";
import type { NewsItem } from "@/types/news";
import type { PriceSnapshot } from "@/types/signal";

export type SignalDataMode = "mock" | "hybrid" | "live";

type EnvLike = Record<string, string | undefined>;

type SignalDataSourceOptions = {
  mode?: SignalDataMode;
  env?: EnvLike;
  priceProvider?: () => Promise<PriceSnapshot[]>;
  newsProvider?: () => Promise<NewsItem[]>;
  metricsStateDir?: string;
  dataSourceStateDir?: string;
};

type PriceFallbackOptions = {
  coinGeckoProvider?: () => Promise<PriceSnapshot[]>;
  cryptoCompareProvider?: () => Promise<PriceSnapshot[]>;
  stateDir?: string;
  cooldownMs?: number;
  now?: Date;
};

export type SignalDataSourceResult = {
  mode: SignalDataMode;
  priceSnapshots: PriceSnapshot[];
  newsItems: NewsItem[];
  warnings: string[];
};

export async function loadSignalDataSources(
  options: SignalDataSourceOptions = {},
): Promise<SignalDataSourceResult> {
  const startedAt = Date.now();
  const env = options.env ?? process.env;
  const mode = options.mode ?? normalizeMode(env.SIGNAL_DATA_MODE);

  if (mode === "mock") {
    return {
      mode,
      priceSnapshots: mockPriceSnapshots,
      newsItems: mockNewsItems,
      warnings: [],
    };
  }

  const priceProvider =
    options.priceProvider ??
    (() =>
      fetchPriceSnapshotsWithFallback({
        coinGeckoProvider: () =>
          fetchCoinGeckoPriceSnapshots({
            baseUrl: env.SIGNAL_PRICE_API_BASE_URL,
            apiKey: env.SIGNAL_PRICE_API_KEY,
            timeoutMs: parsePositiveInteger(env.SIGNAL_DATA_TIMEOUT_MS, 8_000),
          }),
        cryptoCompareProvider: () =>
          fetchCryptoComparePriceSnapshots({
            baseUrl: env.SIGNAL_CRYPTOCOMPARE_API_BASE_URL,
            apiKey: env.SIGNAL_CRYPTOCOMPARE_API_KEY,
            timeoutMs: parsePositiveInteger(env.SIGNAL_DATA_TIMEOUT_MS, 8_000),
          }),
        stateDir: options.dataSourceStateDir ?? env.HOTPURSUIT_DATA_SOURCE_STATE_DIR,
        cooldownMs: parsePositiveInteger(env.HOTPURSUIT_DATA_SOURCE_COOLDOWN_MS, 60_000),
      }));
  const newsProvider =
    options.newsProvider ??
    (() =>
      fetchRssNewsItems({
        url: env.SIGNAL_NEWS_RSS_URL,
        timeoutMs: parsePositiveInteger(env.SIGNAL_DATA_TIMEOUT_MS, 8_000),
        translator: getNewsTranslatorFromEnv(env),
      }));

  const [priceResult, newsResult] = await Promise.allSettled([priceProvider(), newsProvider()]);
  const warnings: string[] = [];
  const livePrices = unwrapResult(priceResult, "price source", warnings);
  const liveNews = unwrapResult(newsResult, "news source", warnings);

  if (mode === "live") {
    const result = {
      mode,
      priceSnapshots: livePrices,
      newsItems: liveNews,
      warnings,
    };
    await recordDataSourceMetric(result, startedAt, options.metricsStateDir);
    return result;
  }

  const result = {
    mode,
    priceSnapshots: mergePriceSnapshots(livePrices, mockPriceSnapshots),
    newsItems: mergeNewsItems(liveNews, mockNewsItems),
    warnings,
  };
  await recordDataSourceMetric(result, startedAt, options.metricsStateDir);
  return result;
}

export async function fetchPriceSnapshotsWithFallback(options: PriceFallbackOptions = {}) {
  const coinGeckoProvider = options.coinGeckoProvider ?? (() => fetchCoinGeckoPriceSnapshots());
  const cryptoCompareProvider =
    options.cryptoCompareProvider ?? (() => fetchCryptoComparePriceSnapshots());
  const healthOptions = { stateDir: options.stateDir, now: options.now };

  if (!(await isDataSourceInCooldown("coingecko", healthOptions))) {
    try {
      const snapshots = await coinGeckoProvider();
      if (snapshots.length) {
        await recordDataSourceSuccess("coingecko", healthOptions);
        return snapshots;
      }
      throw new Error("coingecko returned no prices");
    } catch (error) {
      await recordDataSourceError("coingecko", error, {
        ...healthOptions,
        cooldownMs: options.cooldownMs,
      });
      await recordDataSourceFallback("coingecko", healthOptions);
      // CryptoCompare is a network fallback when CoinGecko is unavailable.
    }
  } else {
    await recordDataSourceFallback("coingecko", healthOptions);
  }

  try {
    const snapshots = await cryptoCompareProvider();
    if (snapshots.length) await recordDataSourceSuccess("cryptocompare", healthOptions);
    return snapshots;
  } catch (error) {
    await recordDataSourceError("cryptocompare", error, healthOptions);
    throw error;
  }
}

function unwrapResult<T>(result: PromiseSettledResult<T[]>, label: string, warnings: string[]) {
  if (result.status === "fulfilled") return result.value;
  warnings.push(`${label} failed: ${errorMessage(result.reason)}`);
  return [];
}

function mergePriceSnapshots(live: PriceSnapshot[], fallback: PriceSnapshot[]) {
  const bySymbol = new Map(fallback.map((item) => [item.symbol, item]));
  for (const item of live) bySymbol.set(item.symbol, item);
  return Array.from(bySymbol.values());
}

function mergeNewsItems(live: NewsItem[], fallback: NewsItem[]) {
  const ids = new Set(live.map((item) => item.id));
  return [...live, ...fallback.filter((item) => !ids.has(item.id))];
}

function normalizeMode(value: string | undefined): SignalDataMode {
  return value === "hybrid" || value === "live" ? value : "mock";
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

async function recordDataSourceMetric(
  result: SignalDataSourceResult,
  startedAt: number,
  stateDir?: string,
) {
  if (!stateDir) return;
  try {
    await appendJsonLine(`${stateDir.replace(/\/+$/, "")}/data-source-load.jsonl`, {
      name: "data_source_load",
      fields: {
        mode: result.mode,
        priceCount: result.priceSnapshots.length,
        newsCount: result.newsItems.length,
        warningCount: result.warnings.length,
        warnings: result.warnings,
        priceSources: Array.from(new Set(result.priceSnapshots.map((item) => item.source))),
        fallbackUsed: result.priceSnapshots.some((item) => item.source === "cryptocompare"),
        latencyMs: Date.now() - startedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[data-sources] failed to write dev data-source metric", error);
    }
  }
}
