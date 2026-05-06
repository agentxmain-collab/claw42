import type { NewsItem, NewsSentiment } from "@/lib/types";
import { CRYPTOPANIC_SOURCE } from "@/lib/news/sourceRegistry";
import {
  apiKeyFor,
  extractCurrenciesFromText,
  publishedAtFrom,
  sourceDomainFromUrl,
  stableNewsId,
  type NewsAdapter,
  type NewsFetchOptions,
} from "./types";

interface CryptoPanicCurrency {
  code?: string;
}

interface CryptoPanicPost {
  id: number | string;
  title?: string;
  url?: string;
  source?: {
    title?: string;
    domain?: string;
  };
  currencies?: CryptoPanicCurrency[];
  votes?: {
    positive?: number;
    negative?: number;
    important?: number;
  };
  published_at?: string;
}

interface CryptoPanicResponse {
  results?: CryptoPanicPost[];
}

function sentimentFromVotes(votes: CryptoPanicPost["votes"]): NewsSentiment {
  const positive = votes?.positive ?? 0;
  const negative = votes?.negative ?? 0;
  if (positive - negative >= 8) return "bullish";
  if (negative - positive >= 5) return "bearish";
  return "neutral";
}

function mapPost(post: CryptoPanicPost): NewsItem | null {
  const title = post.title?.trim();
  const url = post.url?.trim();
  if (!title || !url) return null;

  return {
    id: stableNewsId(CRYPTOPANIC_SOURCE.id, post.id, url, title),
    title,
    url,
    source: post.source?.title?.trim() || CRYPTOPANIC_SOURCE.displayName,
    sourceDomain: post.source?.domain ?? sourceDomainFromUrl(url),
    currencies:
      post.currencies
        ?.map((currency) => currency.code?.toUpperCase())
        .filter((code): code is string => Boolean(code)) ?? extractCurrenciesFromText(title),
    sentiment: sentimentFromVotes(post.votes),
    publishedAt: publishedAtFrom(post.published_at),
    votes: {
      positive: post.votes?.positive ?? 0,
      negative: post.votes?.negative ?? 0,
      important: post.votes?.important ?? 0,
    },
  };
}

export class CryptoPanicAdapter implements NewsAdapter {
  readonly source = CRYPTOPANIC_SOURCE;
  readonly sourceId = this.source.id;

  isAvailable(): boolean {
    return this.source.status === "standby" && Boolean(apiKeyFor(this.source));
  }

  async fetch(opts: NewsFetchOptions): Promise<NewsItem[]> {
    const apiKey = apiKeyFor(this.source);
    if (!apiKey) return [];

    const params = new URLSearchParams({
      auth_token: apiKey,
      public: "true",
      filter: "hot",
    });

    const response = await fetch(`${this.source.endpoint}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`${this.source.displayName} ${response.status}`);

    const data = (await response.json()) as CryptoPanicResponse;
    return (data.results ?? [])
      .map(mapPost)
      .filter((item): item is NewsItem => Boolean(item))
      .slice(0, opts.limit);
  }
}
