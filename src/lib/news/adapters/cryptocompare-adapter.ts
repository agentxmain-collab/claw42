import type { NewsItem } from "@/lib/types";
import { CRYPTOCOMPARE_SOURCE } from "@/lib/news/sourceRegistry";
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

interface CryptoCompareArticle {
  id?: string | number;
  guid?: string;
  title?: string;
  url?: string;
  source?: string;
  published_on?: number;
  tags?: string;
  categories?: string;
  body?: string;
}

interface CryptoCompareResponse {
  Data?: CryptoCompareArticle[];
}

function mapArticle(article: CryptoCompareArticle): NewsItem | null {
  const title = article.title?.trim();
  const url = absoluteUrl(article.url, CRYPTOCOMPARE_SOURCE.endpoint);
  if (!title || !url) return null;

  const descriptor = [title, article.tags, article.categories, article.body].join(" ");
  return {
    id: stableNewsId(CRYPTOCOMPARE_SOURCE.id, article.id ?? article.guid, url, title),
    title,
    url,
    source: article.source?.trim() || CRYPTOCOMPARE_SOURCE.displayName,
    sourceDomain: sourceDomainFromUrl(url),
    currencies: extractCurrenciesFromText(title, article.tags, article.categories),
    sentiment: sentimentFromText(descriptor),
    publishedAt: publishedAtFrom(article.published_on),
  };
}

export class CryptoCompareAdapter implements NewsAdapter {
  readonly source = CRYPTOCOMPARE_SOURCE;
  readonly sourceId = this.source.id;

  isAvailable(): boolean {
    return isSourceConfigured(this.source);
  }

  async fetch(opts: NewsFetchOptions): Promise<NewsItem[]> {
    const apiKey = apiKeyFor(this.source);
    if (!apiKey) return [];

    const params = new URLSearchParams({ lang: "EN" });
    const response = await fetch(`${this.source.endpoint}&${params}`, {
      cache: "no-store",
      headers: { authorization: `Apikey ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`${this.source.displayName} ${response.status}`);

    const data = (await response.json()) as CryptoCompareResponse;
    return (data.Data ?? [])
      .map(mapArticle)
      .filter((item): item is NewsItem => Boolean(item))
      .slice(0, opts.limit);
  }
}
