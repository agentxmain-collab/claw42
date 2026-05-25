import type { NewsSourceConfig } from "@/lib/news/sourceRegistry";
import { RssNewsAdapter } from "./rss-adapter";

export const PANEWS_RSS_ENDPOINT_MARKER = "panewslab";
export const PANEWS_RSS_SOURCE_MARKER = "rss-panews";

export class PanewsRssAdapter extends RssNewsAdapter {
  constructor(source: NewsSourceConfig) {
    super(source);
  }
}
