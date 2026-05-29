import type { NewsItem } from "@/lib/types";
import { FORESIGHTNEWS_SOURCE } from "@/lib/news/sourceRegistry";
import {
  absoluteUrl,
  apiKeyFor,
  extractCurrenciesFromText,
  isSourceConfigured,
  publishedAtFrom,
  sentimentFromText,
  sourceDomainFromUrl,
  stableNewsId,
  type NewsAdapter,
  type NewsFetchOptions,
} from "./types";

type ForesightNewsResponse =
  | ForesightNewsItem[]
  | {
      data?: ForesightNewsItem[] | { list?: ForesightNewsItem[]; items?: ForesightNewsItem[] };
      result?: ForesightNewsItem[] | { list?: ForesightNewsItem[]; items?: ForesightNewsItem[] };
      results?: ForesightNewsItem[];
      news?: ForesightNewsItem[];
      items?: ForesightNewsItem[];
      list?: ForesightNewsItem[];
    };

type ForesightNewsItem = Record<string, unknown>;

const FORESIGHTNEWS_TOKEN_ENV = "FORESIGHTNEWS_TOKEN";

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function extractArray(value: ForesightNewsResponse): ForesightNewsItem[] {
  if (Array.isArray(value)) return value;
  const candidates = [value.data, value.result, value.results, value.news, value.items, value.list];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = candidate as { list?: ForesightNewsItem[]; items?: ForesightNewsItem[] };
      if (Array.isArray(nested.list)) return nested.list;
      if (Array.isArray(nested.items)) return nested.items;
    }
  }
  return [];
}

function currenciesFromNative(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return [record.symbol, record.currency, record.coin, record.name].filter(
          (entry): entry is string => typeof entry === "string",
        );
      }
      return [];
    })
    .map((symbol) => symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
    .filter(Boolean);
}

export class ForesightNewsAdapter implements NewsAdapter {
  readonly source = FORESIGHTNEWS_SOURCE;
  readonly sourceId = this.source.id;

  isAvailable(): boolean {
    if (this.source.envKey !== FORESIGHTNEWS_TOKEN_ENV) return false;
    return isSourceConfigured(this.source);
  }

  async fetch(opts: NewsFetchOptions): Promise<NewsItem[]> {
    const apiKey = apiKeyFor(this.source);
    if (!apiKey) return [];

    const url = new URL(this.source.endpoint);
    url.searchParams.set("token", apiKey);
    url.searchParams.set("limit", String(opts.limit));

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      throw new Error(`foresightnews_fetch_failed:${response.status}`);
    }
    const json = (await response.json()) as ForesightNewsResponse;
    return extractArray(json)
      .map((item) => this.mapItem(item))
      .filter((item): item is NewsItem => Boolean(item))
      .slice(0, opts.limit);
  }

  private mapItem(item: ForesightNewsItem): NewsItem | null {
    const title = firstString(item.title, item.headline, item.name);
    const summary = firstString(item.summary, item.description, item.content, item.digest);
    const url = absoluteUrl(
      firstString(item.url, item.link, item.source_url, item.sourceUrl),
      this.source.endpoint,
    );
    if (!title || !url) return null;

    const nativeCurrencies = currenciesFromNative(
      item.currencies ?? item.currency ?? item.coins ?? item.tags,
    );
    const currencies =
      nativeCurrencies.length > 0
        ? Array.from(new Set(nativeCurrencies))
        : extractCurrenciesFromText(title, summary);

    return {
      id: stableNewsId(this.sourceId, item.id ?? item.news_id ?? item.uuid, url, title),
      title,
      url,
      source: this.source.displayName,
      sourceDomain: sourceDomainFromUrl(url),
      currencies,
      sentiment: sentimentFromText(`${title} ${summary}`),
      publishedAt: publishedAtFrom(
        item.publishedAt ??
          item.published_at ??
          item.publish_time ??
          item.publishTime ??
          item.created_at ??
          item.createdAt ??
          item.time,
      ),
    };
  }
}
