import type { NewsItem, NewsSentiment } from "@/lib/types";
import type { NewsSourceConfig, NewsSourceId } from "@/lib/news/sourceRegistry";

export interface NewsFetchOptions {
  limit: number;
}

export interface NewsAdapter {
  source: NewsSourceConfig;
  sourceId: NewsSourceId;
  fetch(opts: NewsFetchOptions): Promise<NewsItem[]>;
  isAvailable(): boolean;
}

export const DEFAULT_NEWS_CURRENCIES = ["BTC", "ETH", "SOL", "USDT"];
const SYMBOL_PATTERN = /\b[A-Z0-9]{2,12}\b/g;
const IGNORED_SYMBOLS = new Set([
  "AI",
  "API",
  "CEO",
  "CEX",
  "DEX",
  "ETF",
  "SEC",
  "USD",
  "US",
  "TVL",
  "NFT",
  "L2",
  "BTCUSD",
  "ETHUSD",
]);

export function isSourceConfigured(source: NewsSourceConfig): boolean {
  if (source.authMode === "none") return source.status === "active";
  return source.status === "active" && Boolean(source.envKey && process.env[source.envKey]);
}

export function apiKeyFor(source: NewsSourceConfig): string | null {
  if (!source.envKey) return null;
  return process.env[source.envKey] || null;
}

export function extractCurrenciesFromText(...parts: Array<string | undefined | null>): string[] {
  const text = parts.filter(Boolean).join(" ").toUpperCase();
  const matches = text.match(SYMBOL_PATTERN) ?? [];
  const unique = new Set<string>();

  for (const match of matches) {
    const symbol = match.replace(/[^A-Z0-9]/g, "");
    if (symbol.length < 2 || symbol.length > 12) continue;
    if (IGNORED_SYMBOLS.has(symbol)) continue;
    unique.add(symbol);
  }

  return Array.from(unique).slice(0, 5);
}

export function sentimentFromText(text: string): NewsSentiment {
  const lower = text.toLowerCase();
  if (/\b(hack|exploit|lawsuit|reject|rejected|ban|outflow|down|falls?|slump|crash)\b/.test(lower))
    return "bearish";
  if (/\b(approve|approved|approval|inflow|launch|partnership|surge|rally|up|gain)\b/.test(lower))
    return "bullish";
  return "neutral";
}

export function absoluteUrl(url: string | undefined, fallbackHost: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(trimmed, fallbackHost).toString();
    } catch {
      return null;
    }
  }
}

export function sourceDomainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function publishedAtFrom(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Date.now();
}

export function stableNewsId(sourceId: NewsSourceId, rawId: unknown, url: string, title: string) {
  const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : "";
  if (id.trim()) return `${sourceId}:${id.trim()}`;
  return `${sourceId}:${Buffer.from(`${url}:${title}`).toString("base64url").slice(0, 32)}`;
}
