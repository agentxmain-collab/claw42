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
const UPPERCASE_SYMBOL_PATTERN = /\b[A-Z0-9]{2,12}\b/g;
const CASH_TAG_PATTERN = /\$([A-Za-z0-9]{2,12})\b/g;
const TRADING_PAIR_PATTERN = /\b([A-Z0-9]{2,12})\s*[/:-]\s*([A-Z0-9]{2,12})\b/g;
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
const COMMON_CRYPTO_SYMBOLS = new Set([
  ...DEFAULT_NEWS_CURRENCIES,
  "USDC",
  "BNB",
  "XRP",
  "DOGE",
  "ADA",
  "AVAX",
  "TON",
  "TRX",
  "DOT",
  "LINK",
  "LTC",
  "BCH",
  "NEAR",
  "SUI",
  "APT",
  "ARB",
  "OP",
  "FIL",
  "ATOM",
  "UNI",
  "AAVE",
  "MKR",
  "TAO",
  "ENA",
  "MORPHO",
  "DEXE",
  "PEPE",
  "SHIB",
  "WIF",
]);
const CURRENCY_NAME_ALIASES: Array<[RegExp, string]> = [
  [/\bbitcoin cash\b/gi, "BCH"],
  [/\bbitcoin\b/gi, "BTC"],
  [/\bethereum\b/gi, "ETH"],
  [/\bether\b/gi, "ETH"],
  [/\bsolana\b/gi, "SOL"],
  [/\btether\b/gi, "USDT"],
  [/\busd coin\b/gi, "USDC"],
  [/\bbinance coin\b/gi, "BNB"],
  [/\bdogecoin\b/gi, "DOGE"],
  [/\bcardano\b/gi, "ADA"],
  [/\bavalanche\b/gi, "AVAX"],
  [/\btron\b/gi, "TRX"],
  [/\bpolkadot\b/gi, "DOT"],
  [/\bchainlink\b/gi, "LINK"],
  [/\blitecoin\b/gi, "LTC"],
  [/\bripple\b/gi, "XRP"],
  [/\btoncoin\b/gi, "TON"],
  [/\bsui\b/gi, "SUI"],
  [/\baptos\b/gi, "APT"],
  [/\barbitrum\b/gi, "ARB"],
  [/\boptimism\b(?=\s+(?:network|token|governance|ecosystem|airdrop|bridge|chain|dao))/gi, "OP"],
  [/\bfilecoin\b/gi, "FIL"],
  [/\bcosmos\b/gi, "ATOM"],
  [/\buniswap\b/gi, "UNI"],
  [/\baave\b/gi, "AAVE"],
  [/\bmakerdao\b/gi, "MKR"],
  [
    /\bmaker\b(?=\s+(?:dao|protocol|token|governance|price|rally|surge|falls?|stablecoin|ecosystem|vaults?))/gi,
    "MKR",
  ],
  [/\bbittensor\b/gi, "TAO"],
  [/\bhyperliquid\b/gi, "HYPE"],
  [/\bethena\b/gi, "ENA"],
  [/\bmorpho\b/gi, "MORPHO"],
  [/\bdexe\b/gi, "DEXE"],
  [/\bpump\.fun\b/gi, "PUMP"],
  [/\bpepe\b/gi, "PEPE"],
  [/\bshiba inu\b/gi, "SHIB"],
];

export function isSourceConfigured(source: NewsSourceConfig): boolean {
  if (source.authMode === "none") return source.status === "active";
  return source.status === "active" && Boolean(source.envKey && process.env[source.envKey]);
}

export function apiKeyFor(source: NewsSourceConfig): string | null {
  if (!source.envKey) return null;
  return process.env[source.envKey] || null;
}

export function extractCurrenciesFromText(...parts: Array<string | undefined | null>): string[] {
  const text = parts.filter(Boolean).join(" ");
  const matches: Array<{ index: number; symbol: string }> = [];

  function add(index: number, rawSymbol: string, allowUnknown = false) {
    const symbol = rawSymbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (symbol.length < 2 || symbol.length > 12) return;
    if (IGNORED_SYMBOLS.has(symbol)) return;
    if (!allowUnknown && !COMMON_CRYPTO_SYMBOLS.has(symbol)) return;
    matches.push({ index, symbol });
  }

  for (const [pattern, symbol] of CURRENCY_NAME_ALIASES) {
    let match: RegExpExecArray | null = null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) add(match.index, symbol, true);
  }

  let cashTagMatch: RegExpExecArray | null = null;
  CASH_TAG_PATTERN.lastIndex = 0;
  while ((cashTagMatch = CASH_TAG_PATTERN.exec(text))) {
    const match = cashTagMatch;
    add(match.index ?? 0, match[1] ?? "", true);
  }

  let pairMatch: RegExpExecArray | null = null;
  TRADING_PAIR_PATTERN.lastIndex = 0;
  while ((pairMatch = TRADING_PAIR_PATTERN.exec(text))) {
    const match = pairMatch;
    const index = match.index ?? 0;
    add(index, match[1] ?? "", true);
    add(index + (match[1]?.length ?? 0) + 1, match[2] ?? "", true);
  }

  let uppercaseMatch: RegExpExecArray | null = null;
  UPPERCASE_SYMBOL_PATTERN.lastIndex = 0;
  while ((uppercaseMatch = UPPERCASE_SYMBOL_PATTERN.exec(text))) {
    const match = uppercaseMatch;
    add(match.index ?? 0, match[0] ?? "");
  }

  const unique = new Set<string>();
  return matches
    .sort((left, right) => left.index - right.index)
    .flatMap((match) => {
      if (unique.has(match.symbol)) return [];
      unique.add(match.symbol);
      return [match.symbol];
    })
    .slice(0, 5);
}

export function sentimentFromText(text: string): NewsSentiment {
  const lower = text.toLowerCase();
  if (
    /\b(hack|exploit|lawsuit|reject|rejected|ban|outflows?|down|falls?|slump|crash)\b/.test(lower)
  )
    return "bearish";
  if (
    /\b(approve|approved|approval|inflows?|launch|partnership|surge|rally|up|gains?)\b/.test(lower)
  )
    return "bullish";
  return "neutral";
}

export function absoluteUrl(url: string | undefined, fallbackHost: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  function safeHttpUrl(parsed: URL) {
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  }

  try {
    return safeHttpUrl(new URL(trimmed));
  } catch {
    try {
      return safeHttpUrl(new URL(trimmed, fallbackHost));
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
