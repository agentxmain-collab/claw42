import type { NewsItem } from "@/lib/types";
import { COINGECKO_SOURCE } from "@/lib/news/sourceRegistry";
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

interface CoinGeckoArticle {
  id?: string | number;
  title?: string;
  url?: string;
  link?: string;
  author?: string;
  news_site?: string;
  source?: string;
  updated_at?: string;
  published_at?: string;
  created_at?: string;
  description?: string;
  summary?: string;
  coin?: string;
  currencies?: string[];
}

type CoinGeckoResponse =
  | CoinGeckoArticle[]
  | {
      data?: CoinGeckoArticle[];
      news?: CoinGeckoArticle[];
    };

function articlesFrom(data: CoinGeckoResponse): CoinGeckoArticle[] {
  if (Array.isArray(data)) return data;
  return data.data ?? data.news ?? [];
}

function mapArticle(article: CoinGeckoArticle): NewsItem | null {
  const title = article.title?.trim();
  const url = absoluteUrl(article.url ?? article.link, COINGECKO_SOURCE.endpoint);
  if (!title || !url) return null;

  const body = article.description ?? article.summary ?? "";
  const nativeSymbols = Array.isArray(article.currencies)
    ? article.currencies.map((symbol) => symbol.toUpperCase())
    : article.coin
      ? [article.coin.toUpperCase()]
      : [];
  const currencies =
    nativeSymbols.length > 0 ? nativeSymbols : extractCurrenciesFromText(title, body);

  return {
    id: stableNewsId(COINGECKO_SOURCE.id, article.id, url, title),
    title,
    url,
    source: article.news_site?.trim() || article.source?.trim() || COINGECKO_SOURCE.displayName,
    sourceDomain: sourceDomainFromUrl(url),
    currencies: currencies.slice(0, 5),
    sentiment: sentimentFromText(`${title} ${body}`),
    publishedAt: publishedAtFrom(article.published_at ?? article.updated_at ?? article.created_at),
  };
}

export class CoinGeckoNewsAdapter implements NewsAdapter {
  readonly source = COINGECKO_SOURCE;
  readonly sourceId = this.source.id;

  isAvailable(): boolean {
    return isSourceConfigured(this.source);
  }

  async fetch(opts: NewsFetchOptions): Promise<NewsItem[]> {
    const apiKey = apiKeyFor(this.source);
    if (!apiKey) return [];

    const response = await fetch(this.source.endpoint, {
      cache: "no-store",
      headers: { "x-cg-demo-api-key": apiKey },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`${this.source.displayName} ${response.status}`);

    const data = (await response.json()) as CoinGeckoResponse;
    return articlesFrom(data)
      .map(mapArticle)
      .filter((item): item is NewsItem => Boolean(item))
      .slice(0, opts.limit);
  }
}
