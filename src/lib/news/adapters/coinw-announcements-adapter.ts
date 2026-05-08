import type { NewsItem } from "@/lib/types";
import { COINW_ANNOUNCEMENTS_SOURCE } from "@/lib/news/sourceRegistry";
import type { NewsAdapter } from "./types";

export class CoinWAnnouncementsAdapter implements NewsAdapter {
  readonly source = COINW_ANNOUNCEMENTS_SOURCE;
  readonly sourceId = this.source.id;

  isAvailable(): boolean {
    return false;
  }

  async fetch(): Promise<NewsItem[]> {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[news] CoinW announcements endpoint is pending Dan partner confirmation");
    }
    return [];
  }
}
