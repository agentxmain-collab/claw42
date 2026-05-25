export type NewsSourceId =
  | "cryptocompare"
  | "coingecko"
  | "cryptopanic"
  | "rss-coindesk"
  | "rss-cointelegraph"
  | "rss-decrypt"
  | "binance-announcements"
  | "coinw-announcements"
  | "foresightnews"
  | "rss-panews-featured"
  | "rss-panews-flash";

export type SourceRole = "primary" | "fallback" | "specialty" | "standby" | "optional";

export type SourceStatus = "active" | "beta" | "planned" | "standby";

export interface NewsSourceConfig {
  id: NewsSourceId;
  status: SourceStatus;
  role: SourceRole;
  displayName: string;
  endpoint: string;
  authMode: "apiKey" | "none";
  envKey?: string;
  rateLimitPerMin?: number;
  monthlyQuota?: number;
  fields: {
    sentimentNative: boolean;
    currenciesNative: boolean;
    votesNative: boolean;
  };
  cspHosts: string[];
  attribution?: string;
}

export const NEWS_SOURCE_REGISTRY: Record<NewsSourceId, NewsSourceConfig> = {
  cryptocompare: {
    id: "cryptocompare",
    status: "active",
    role: "primary",
    displayName: "CryptoCompare",
    endpoint: "https://min-api.cryptocompare.com/data/v2/news/?lang=EN",
    authMode: "apiKey",
    envKey: "CRYPTOCOMPARE_API_KEY",
    rateLimitPerMin: 50,
    monthlyQuota: 100_000,
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://min-api.cryptocompare.com"],
    attribution: "Powered by CryptoCompare",
  },
  coingecko: {
    id: "coingecko",
    status: "active",
    role: "fallback",
    displayName: "CoinGecko",
    endpoint: "https://pro-api.coingecko.com/api/v3/news",
    authMode: "apiKey",
    envKey: "COINGECKO_DEMO_KEY",
    rateLimitPerMin: 30,
    monthlyQuota: 10_000,
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://api.coingecko.com", "https://pro-api.coingecko.com"],
    attribution: "Powered by CoinGecko",
  },
  cryptopanic: {
    id: "cryptopanic",
    status: "active",
    role: "fallback",
    displayName: "CryptoPanic",
    endpoint: "https://cryptopanic.com/api/v1/posts/",
    authMode: "apiKey",
    envKey: "CRYPTOPANIC_API_KEY",
    fields: { sentimentNative: false, currenciesNative: true, votesNative: true },
    cspHosts: ["https://cryptopanic.com"],
    attribution: "Powered by CryptoPanic",
  },
  "rss-coindesk": {
    id: "rss-coindesk",
    status: "active",
    role: "fallback",
    displayName: "CoinDesk",
    endpoint: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://www.coindesk.com"],
    attribution: "Source: CoinDesk",
  },
  "rss-cointelegraph": {
    id: "rss-cointelegraph",
    status: "active",
    role: "fallback",
    displayName: "Cointelegraph",
    endpoint: "https://cointelegraph.com/rss",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://cointelegraph.com"],
    attribution: "Source: Cointelegraph",
  },
  "rss-decrypt": {
    id: "rss-decrypt",
    status: "active",
    role: "fallback",
    displayName: "Decrypt",
    endpoint: "https://decrypt.co/feed",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://decrypt.co"],
    attribution: "Source: Decrypt",
  },
  foresightnews: {
    id: "foresightnews",
    status: "active",
    role: "primary",
    displayName: "ForesightNews",
    endpoint: "https://api.foresightnews.pro/v1/outapi/news",
    authMode: "apiKey",
    envKey: "FORESIGHTNEWS_TOKEN",
    rateLimitPerMin: 20,
    fields: { sentimentNative: false, currenciesNative: true, votesNative: false },
    cspHosts: ["https://api.foresightnews.pro"],
    attribution: "Source: ForesightNews",
  },
  "rss-panews-featured": {
    id: "rss-panews-featured",
    status: "active",
    role: "fallback",
    displayName: "PANews 精选",
    endpoint: "https://www.panewslab.com/rss.xml?lang=zh&type=NORMAL&featured=true",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://www.panewslab.com"],
    attribution: "Source: PANews",
  },
  "rss-panews-flash": {
    id: "rss-panews-flash",
    status: "active",
    role: "primary",
    displayName: "PANews 快讯",
    endpoint: "https://www.panewslab.com/rss.xml?lang=zh&type=NEWS",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://www.panewslab.com"],
    attribution: "Source: PANews",
  },
  "binance-announcements": {
    id: "binance-announcements",
    status: "active",
    role: "specialty",
    displayName: "Binance Announcements",
    endpoint: "https://www.binance.com/en/support/announcement/c-48?navId=48",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: ["https://www.binance.com"],
    attribution: "Source: Binance Announcements",
  },
  "coinw-announcements": {
    id: "coinw-announcements",
    status: "planned",
    role: "specialty",
    displayName: "CoinW Announcements",
    endpoint: "claw42-todo://coinw-announcements-feed",
    authMode: "none",
    fields: { sentimentNative: false, currenciesNative: false, votesNative: false },
    cspHosts: [],
    attribution: "Source: CoinW Announcements",
  },
};

export const NEWS_SOURCE_IDS = Object.freeze(
  Object.fromEntries(
    Object.entries(NEWS_SOURCE_REGISTRY).map(([key, value]) => [
      key.toUpperCase().replaceAll("-", "_"),
      value.id,
    ]),
  ) as Record<Uppercase<NewsSourceId> extends infer T ? Extract<T, string> : never, NewsSourceId>,
);

export const NEWS_SOURCE_CONFIGS = Object.values(NEWS_SOURCE_REGISTRY);
export const CRYPTOCOMPARE_SOURCE = NEWS_SOURCE_REGISTRY.cryptocompare;
export const COINGECKO_SOURCE = NEWS_SOURCE_REGISTRY.coingecko;
export const CRYPTOPANIC_SOURCE = NEWS_SOURCE_REGISTRY.cryptopanic;
export const RSS_COINDESK_SOURCE = NEWS_SOURCE_REGISTRY["rss-coindesk"];
export const RSS_COINTELEGRAPH_SOURCE = NEWS_SOURCE_REGISTRY["rss-cointelegraph"];
export const RSS_DECRYPT_SOURCE = NEWS_SOURCE_REGISTRY["rss-decrypt"];
export const FORESIGHTNEWS_SOURCE = NEWS_SOURCE_REGISTRY.foresightnews;
export const RSS_PANEWS_FEATURED_SOURCE = NEWS_SOURCE_REGISTRY["rss-panews-featured"];
export const RSS_PANEWS_FLASH_SOURCE = NEWS_SOURCE_REGISTRY["rss-panews-flash"];
export const BINANCE_ANNOUNCEMENTS_SOURCE = NEWS_SOURCE_REGISTRY["binance-announcements"];
export const COINW_ANNOUNCEMENTS_SOURCE = NEWS_SOURCE_REGISTRY["coinw-announcements"];

export function isNewsSourceId(value: string): value is NewsSourceId {
  return value in NEWS_SOURCE_REGISTRY;
}

export function getNewsSourceConfig(id: NewsSourceId): NewsSourceConfig {
  return NEWS_SOURCE_REGISTRY[id];
}

export function getActiveSources(role?: SourceRole): NewsSourceConfig[] {
  return NEWS_SOURCE_CONFIGS.filter(
    (source) => source.status === "active" && (!role || source.role === role),
  );
}

export function getStandbySources(): NewsSourceConfig[] {
  return NEWS_SOURCE_CONFIGS.filter((source) => source.status === "standby");
}

export function getSourceChain(): NewsSourceConfig[] {
  const order: SourceRole[] = ["primary", "fallback", "specialty"];
  const sources = order.flatMap((role) => getActiveSources(role));
  const override = process.env.NEWS_PRIMARY_SOURCE;

  if (!override || !isNewsSourceId(override)) return sources;

  const index = sources.findIndex((source) => source.id === override);
  if (index <= 0) return sources;

  const preferred = sources[index];
  return preferred ? [preferred, ...sources.slice(0, index), ...sources.slice(index + 1)] : sources;
}

export function getSourceCspHosts(): string[] {
  return Array.from(new Set(NEWS_SOURCE_CONFIGS.flatMap((source) => source.cspHosts)));
}
