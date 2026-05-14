import { globalFailureCooler } from "@/lib/utils/failureCooler";
import type { NewsItem } from "@/lib/types";
import {
  BINANCE_ANNOUNCEMENTS_SOURCE,
  COINGECKO_SOURCE,
  COINW_ANNOUNCEMENTS_SOURCE,
  CRYPTOCOMPARE_SOURCE,
  CRYPTOPANIC_SOURCE,
  getSourceChain,
  getStandbySources,
  isNewsSourceId,
  RSS_COINDESK_SOURCE,
  RSS_COINTELEGRAPH_SOURCE,
  RSS_DECRYPT_SOURCE,
  type NewsSourceConfig,
  type NewsSourceId,
} from "@/lib/news/sourceRegistry";
import { getCachedNews, isNegativeCached, setCachedNews, setNegativeCache } from "@/lib/news/cache";
import { recordNewsSourceUsage } from "@/lib/news/quotaTracker";
import { BinanceAnnouncementsAdapter } from "@/lib/news/adapters/binance-announcements-adapter";
import { CoinGeckoNewsAdapter } from "@/lib/news/adapters/coingecko-news-adapter";
import { CoinWAnnouncementsAdapter } from "@/lib/news/adapters/coinw-announcements-adapter";
import { CryptoCompareAdapter } from "@/lib/news/adapters/cryptocompare-adapter";
import { CryptoPanicAdapter } from "@/lib/news/adapters/cryptopanic-adapter";
import { RssNewsAdapter } from "@/lib/news/adapters/rss-adapter";
import type { NewsAdapter } from "@/lib/news/adapters/types";
import mockNews from "./mock-news.json";

export type NewsChainServedBy = NewsSourceId | "mock";

export interface NewsChainResult {
  items: NewsItem[];
  servedBy: NewsChainServedBy;
  fellBackFrom: NewsSourceId[];
}

const ADAPTERS = new Map<NewsSourceId, NewsAdapter>([
  [CRYPTOCOMPARE_SOURCE.id, new CryptoCompareAdapter()],
  [COINGECKO_SOURCE.id, new CoinGeckoNewsAdapter()],
  [RSS_COINDESK_SOURCE.id, new RssNewsAdapter(RSS_COINDESK_SOURCE)],
  [RSS_COINTELEGRAPH_SOURCE.id, new RssNewsAdapter(RSS_COINTELEGRAPH_SOURCE)],
  [RSS_DECRYPT_SOURCE.id, new RssNewsAdapter(RSS_DECRYPT_SOURCE)],
  [BINANCE_ANNOUNCEMENTS_SOURCE.id, new BinanceAnnouncementsAdapter()],
  [COINW_ANNOUNCEMENTS_SOURCE.id, new CoinWAnnouncementsAdapter()],
  [CRYPTOPANIC_SOURCE.id, new CryptoPanicAdapter()],
]);

function shouldUseStandbySources() {
  return process.env.NEWS_ENABLE_STANDBY_SOURCES === "1";
}

function chainSources(): NewsSourceConfig[] {
  const sources = getSourceChain();
  const fullChain = shouldUseStandbySources() ? [...sources, ...getStandbySources()] : sources;
  const preferredSource = process.env.NEWS_PRIMARY_SOURCE;
  if (!preferredSource || !isNewsSourceId(preferredSource)) return fullChain;

  const index = fullChain.findIndex((source) => source.id === preferredSource);
  if (index <= 0) return fullChain;

  const preferred = fullChain[index];
  return preferred
    ? [preferred, ...fullChain.slice(0, index), ...fullChain.slice(index + 1)]
    : fullChain;
}

function mockItems(limit: number): NewsItem[] {
  const now = Date.now();
  return (mockNews as NewsItem[]).slice(0, limit).map((item, index) => ({
    ...item,
    id: `${item.id}:${Math.floor(now / 600_000)}`,
    publishedAt: now - (index + 1) * 6 * 60_000,
  }));
}

function recordNewsEvent(event: string, properties: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      type: "claw42_news_event",
      event,
      ts: new Date().toISOString(),
      ...properties,
    }),
  );
}

async function fetchFromAdapter(adapter: NewsAdapter, limit: number): Promise<NewsItem[]> {
  const cached = getCachedNews(adapter.sourceId, { limit });
  if (cached) return cached;

  if (isNegativeCached(adapter.sourceId) || globalFailureCooler.isCooling(adapter.sourceId)) {
    return [];
  }

  try {
    const items = await adapter.fetch({ limit });
    globalFailureCooler.clear(adapter.sourceId);
    const usage = recordNewsSourceUsage(adapter.sourceId);
    if (usage.shouldAlert) {
      recordNewsEvent("news_quota_alert", {
        source_id: adapter.sourceId,
        used_pct: usage.usedPct,
      });
    }
    if (items.length > 0) setCachedNews(adapter.sourceId, { limit }, items);
    return items;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    globalFailureCooler.markFailure(adapter.sourceId, message);
    setNegativeCache(adapter.sourceId);
    recordNewsEvent("news_source_failed", {
      source_id: adapter.sourceId,
      error_class: error instanceof Error ? error.name : "UnknownError",
    });
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[news] ${adapter.source.displayName} failed, falling back`, error);
    }
    return [];
  }
}

export async function fetchNewsWithChain(opts: { limit: number }): Promise<NewsChainResult> {
  const fellBackFrom: NewsSourceId[] = [];

  for (const source of chainSources()) {
    const adapter = ADAPTERS.get(source.id);
    if (!adapter || !adapter.isAvailable()) {
      fellBackFrom.push(source.id);
      continue;
    }

    const items = await fetchFromAdapter(adapter, opts.limit);
    if (items.length > 0) {
      recordNewsEvent("news_fetched", {
        served_by: source.id,
        fellback_count: fellBackFrom.length,
      });
      return { items, servedBy: source.id, fellBackFrom };
    }

    fellBackFrom.push(source.id);
  }

  recordNewsEvent("news_fetched", {
    served_by: "mock",
    fellback_count: fellBackFrom.length,
  });

  return {
    items: mockItems(opts.limit),
    servedBy: "mock",
    fellBackFrom,
  };
}
