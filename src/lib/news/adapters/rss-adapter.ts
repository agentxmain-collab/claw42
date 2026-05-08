import Parser from "rss-parser";
import type { NewsItem } from "@/lib/types";
import type { NewsSourceConfig } from "@/lib/news/sourceRegistry";
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

type RssFeed = {
  items?: RssItem[];
};

type RssItem = {
  guid?: string;
  id?: string;
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
};

const parser: Parser<RssFeed, RssItem> = new Parser({
  timeout: 5000,
  customFields: {
    item: ["guid", "id", "contentSnippet", "content", ["category", "categories"]],
  },
});

function summaryOf(item: RssItem): string {
  return (item.contentSnippet ?? item.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 200);
}

export class RssNewsAdapter implements NewsAdapter {
  readonly sourceId = this.source.id;

  constructor(readonly source: NewsSourceConfig) {}

  isAvailable(): boolean {
    return isSourceConfigured(this.source);
  }

  async fetch(opts: NewsFetchOptions): Promise<NewsItem[]> {
    const feed = await parser.parseURL(this.source.endpoint);
    return (feed.items ?? [])
      .map((item) => this.mapItem(item))
      .filter((item): item is NewsItem => Boolean(item))
      .slice(0, opts.limit);
  }

  private mapItem(item: RssItem): NewsItem | null {
    const title = item.title?.trim();
    const url = absoluteUrl(item.link, this.source.endpoint);
    if (!title || !url) return null;

    const summary = summaryOf(item);
    const categories = Array.isArray(item.categories) ? item.categories.join(" ") : "";

    return {
      id: stableNewsId(this.sourceId, item.guid ?? item.id, url, title),
      title,
      url,
      source: this.source.displayName,
      sourceDomain: sourceDomainFromUrl(url),
      currencies: extractCurrenciesFromText(title, categories, summary),
      sentiment: sentimentFromText(`${title} ${summary}`),
      publishedAt: publishedAtFrom(item.isoDate ?? item.pubDate),
    };
  }
}
