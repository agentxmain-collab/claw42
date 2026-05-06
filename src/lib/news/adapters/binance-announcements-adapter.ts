import type { NewsItem } from "@/lib/types";
import { BINANCE_ANNOUNCEMENTS_SOURCE } from "@/lib/news/sourceRegistry";
import {
  absoluteUrl,
  extractCurrenciesFromText,
  isSourceConfigured,
  publishedAtFrom,
  sentimentFromText,
  sourceDomainFromUrl,
  stableNewsId,
  type NewsAdapter,
  type NewsFetchOptions,
} from "./types";

const ANNOUNCEMENT_LINK_PATTERN =
  /<a[^>]+href=["']([^"']*\/support\/announcement\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class BinanceAnnouncementsAdapter implements NewsAdapter {
  readonly source = BINANCE_ANNOUNCEMENTS_SOURCE;
  readonly sourceId = this.source.id;

  isAvailable(): boolean {
    return isSourceConfigured(this.source);
  }

  async fetch(opts: NewsFetchOptions): Promise<NewsItem[]> {
    const response = await fetch(this.source.endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`${this.source.displayName} ${response.status}`);

    const html = await response.text();
    const items: NewsItem[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    ANNOUNCEMENT_LINK_PATTERN.lastIndex = 0;

    while ((match = ANNOUNCEMENT_LINK_PATTERN.exec(html)) !== null) {
      const url = absoluteUrl(match[1], this.source.endpoint);
      const title = cleanText(match[2] ?? "");
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      items.push({
        id: stableNewsId(this.sourceId, url, url, title),
        title,
        url,
        source: this.source.displayName,
        sourceDomain: sourceDomainFromUrl(url),
        currencies: extractCurrenciesFromText(title),
        sentiment: sentimentFromText(title),
        publishedAt: publishedAtFrom(Date.now()),
      });
      if (items.length >= opts.limit) break;
    }

    return items;
  }
}
