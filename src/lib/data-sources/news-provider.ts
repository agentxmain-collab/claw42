import type { LocalizedText, MarketDirection, Severity, Tone } from "@/types/common";
import type { NewsItem } from "@/types/news";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type NewsTranslationInput = {
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
};

export type NewsTranslationResult = {
  title: LocalizedText;
  summary: LocalizedText;
};

export type NewsTranslator = (input: NewsTranslationInput) => Promise<NewsTranslationResult>;

type RssNewsOptions = {
  url?: string;
  fetcher?: Fetcher;
  limit?: number;
  timeoutMs?: number;
  translator?: NewsTranslator;
};

const defaultRssUrl = "https://cryptobriefing.com/feed/";
const defaultTimeoutMs = 8_000;
const defaultLimit = 5;

export async function fetchRssNewsItems(options: RssNewsOptions = {}): Promise<NewsItem[]> {
  const url = options.url ?? defaultRssUrl;
  const response = await fetchWithTimeout(
    options.fetcher ?? fetch,
    url,
    options.timeoutMs ?? defaultTimeoutMs,
  );
  if (!response.ok) throw new Error(`news source failed with ${response.status}`);
  const xml = await response.text();
  return parseRssItems(xml, url, options.limit ?? defaultLimit, options.translator);
}

async function parseRssItems(
  xml: string,
  sourceUrl: string,
  limit: number,
  translator?: NewsTranslator,
) {
  const source = extractTag(xml, "channel", "title") ?? hostname(sourceUrl);
  const itemBlocks = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).map(
    (match) => match[1],
  );

  return Promise.all(
    itemBlocks.slice(0, limit).map(async (block, index) => {
      const title = cleanText(extractTag(block, "title") ?? "Untitled market update");
      const summary = cleanText(extractTag(block, "description") ?? title);
      const publishedAt = normalizeDate(cleanText(extractTag(block, "pubDate") ?? ""));
      const direction = inferDirection(`${title} ${summary}`);
      const severity = inferSeverity(`${title} ${summary}`);
      const translated = await translateItem(translator, { title, summary, source, publishedAt });
      const localizedTitle = translated?.title ?? localizedEnglishSource(title);
      const localizedSummary = translated?.summary ?? localizedEnglishSource(summary);
      const id = `rss-${slugify(title)}-${index}`;

      return {
        id,
        title: localizedTitle,
        summary: localizedSummary,
        fullSummary: localizedSummary,
        source,
        publishedAt,
        severity,
        tone: directionToTone(direction),
        marketDirection: direction,
        outlook: {
          title: localized("等待市场确认"),
          summary: localized("该 RSS 事件已进入信号池，后续需要结合价格和多源证据确认。"),
          confidence: severity === "high" ? 62 : 52,
        },
        impactedAssets: inferAssets(`${title} ${summary}`).map((symbol) => ({
          symbol,
          direction,
          severity,
          note: localized(`${symbol} 与该英文源事件存在直接或间接相关性。`),
        })),
        timeline: [
          {
            id: `${id}-tl`,
            datetime: publishedAt,
            title: localizedTitle,
            detail: localizedSummary,
          },
        ],
      };
    }),
  );
}

async function translateItem(translator: NewsTranslator | undefined, input: NewsTranslationInput) {
  if (!translator) return null;
  try {
    return await translator(input);
  } catch (error) {
    console.warn("[data-sources] RSS translation failed, using English-source fallback", error);
    return null;
  }
}

function extractTag(xml: string, tag: string): string | null;
function extractTag(xml: string, parent: string, tag: string): string | null;
function extractTag(xml: string, parentOrTag: string, maybeTag?: string) {
  if (!maybeTag) {
    const match = xml.match(
      new RegExp(`<${parentOrTag}\\b[^>]*>([\\s\\S]*?)<\\/${parentOrTag}>`, "i"),
    );
    return match?.[1] ?? null;
  }
  const parent = extractTag(xml, parentOrTag);
  return parent ? extractTag(parent, maybeTag) : null;
}

async function fetchWithTimeout(fetcher: Fetcher, url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function inferAssets(text: string) {
  const upper = text.toUpperCase();
  const symbols = ["BTC", "ETH", "SOL", "USDC", "RWA"].filter((symbol) => upper.includes(symbol));
  if (upper.includes("BITCOIN") && !symbols.includes("BTC")) symbols.push("BTC");
  if (upper.includes("ETHEREUM") && !symbols.includes("ETH")) symbols.push("ETH");
  if (upper.includes("SOLANA") && !symbols.includes("SOL")) symbols.push("SOL");
  return symbols.length ? symbols : ["MARKET"];
}

function inferDirection(text: string): MarketDirection {
  const normalized = text.toLowerCase();
  if (/(hack|exploit|outflow|falls?|drops?|selloff|lawsuit|rejected)/i.test(normalized))
    return "bearish";
  if (/(rises?|rally|inflow|approval|improves?|surges?|breakout|demand)/i.test(normalized))
    return "bullish";
  return "neutral";
}

function inferSeverity(text: string): Severity {
  return /(etf|fed|sec|hack|exploit|lawsuit|bitcoin|ethereum|solana|btc|eth|sol)/i.test(text)
    ? "high"
    : "medium";
}

function directionToTone(direction: MarketDirection): Tone {
  if (direction === "bullish") return "risk_on";
  if (direction === "bearish") return "risk_off";
  return "neutral";
}

function normalizeDate(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
}

function cleanText(value: string) {
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function localized(text: string): LocalizedText {
  return { zh: text, en: text };
}

function localizedEnglishSource(text: string): LocalizedText {
  return { zh: `英文源：${text}`, en: text };
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "market-update"
  );
}

function hostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "RSS";
  }
}
