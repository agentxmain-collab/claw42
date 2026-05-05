import type { NewsItem, NewsSentiment, NewsSourceMode } from "@/lib/types";
import { globalFailureCooler } from "@/lib/utils/failureCooler";

const CRYPTOPANIC_ENDPOINT = "https://cryptopanic.com/api/v1/posts/";
const DEFAULT_CURRENCIES = ["BTC", "ETH", "SOL", "USDT"];
const CRYPTOPANIC_COOLER_KEY = "cryptopanic:posts";

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

function envMode(): NewsSourceMode {
  const mode = process.env.CRYPTOPANIC_MODE;
  if (mode === "live" || mode === "mock" || mode === "hybrid") return mode;
  return process.env.CRYPTOPANIC_API_KEY ? "hybrid" : "mock";
}

function sentimentFromVotes(votes: CryptoPanicPost["votes"]): NewsSentiment {
  const positive = votes?.positive ?? 0;
  const negative = votes?.negative ?? 0;
  if (positive - negative >= 8) return "bullish";
  if (negative - positive >= 5) return "bearish";
  return "neutral";
}

function normalizePost(post: CryptoPanicPost): NewsItem | null {
  const title = post.title?.trim();
  const url = post.url?.trim();
  if (!title || !url) return null;

  return {
    id: String(post.id),
    title,
    url,
    source: post.source?.title?.trim() || "CryptoPanic",
    sourceDomain: post.source?.domain,
    currencies:
      post.currencies
        ?.map((currency) => currency.code?.toUpperCase())
        .filter((code): code is string => Boolean(code)) ?? [],
    sentiment: sentimentFromVotes(post.votes),
    publishedAt: post.published_at ? Date.parse(post.published_at) : Date.now(),
    votes: {
      positive: post.votes?.positive ?? 0,
      negative: post.votes?.negative ?? 0,
      important: post.votes?.important ?? 0,
    },
  };
}

export function mockCryptoPanicNews(now = Date.now()): NewsItem[] {
  return [
    {
      id: `mock-etf-${Math.floor(now / 480_000)}`,
      title: "BTC ETF inflow accelerates while ETH volatility compresses",
      url: "https://cryptopanic.com/news/mock-btc-etf",
      source: "CryptoPanic Mock",
      sourceDomain: "cryptopanic.com",
      currencies: ["BTC", "ETH"],
      sentiment: "bullish",
      publishedAt: now - 6 * 60_000,
      votes: { positive: 38, negative: 4, important: 11 },
    },
    {
      id: `mock-sol-${Math.floor(now / 720_000)}`,
      title: "SOL ecosystem token launch lifts on-chain activity",
      url: "https://cryptopanic.com/news/mock-sol-launch",
      source: "CryptoPanic Mock",
      sourceDomain: "cryptopanic.com",
      currencies: ["SOL"],
      sentiment: "neutral",
      publishedAt: now - 18 * 60_000,
      votes: { positive: 18, negative: 9, important: 4 },
    },
  ];
}

export async function fetchCryptoPanicNews(
  options: {
    mode?: NewsSourceMode;
    currencies?: string[];
    limit?: number;
  } = {},
): Promise<{ mode: NewsSourceMode; items: NewsItem[]; degraded: boolean }> {
  const mode = options.mode ?? envMode();
  const apiKey = process.env.CRYPTOPANIC_API_KEY;
  const currencies = options.currencies ?? DEFAULT_CURRENCIES;
  const limit = options.limit ?? 20;

  if (mode === "mock" || !apiKey || globalFailureCooler.isCooling(CRYPTOPANIC_COOLER_KEY)) {
    return {
      mode: "mock",
      items: mockCryptoPanicNews().slice(0, limit),
      degraded: mode !== "mock",
    };
  }

  const params = new URLSearchParams({
    auth_token: apiKey,
    public: "true",
    filter: "hot",
    currencies: currencies.join(","),
  });

  try {
    const response = await fetch(`${CRYPTOPANIC_ENDPOINT}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`cryptopanic ${response.status}`);
    const data = (await response.json()) as CryptoPanicResponse;
    const items = (data.results ?? [])
      .map(normalizePost)
      .filter((item): item is NewsItem => item !== null);
    globalFailureCooler.clear(CRYPTOPANIC_COOLER_KEY);
    return { mode: "live", items: items.slice(0, limit), degraded: false };
  } catch (error) {
    globalFailureCooler.markFailure(CRYPTOPANIC_COOLER_KEY, (error as Error).message);
    if (mode === "live") throw error;
    return { mode: "mock", items: mockCryptoPanicNews().slice(0, limit), degraded: true };
  }
}
