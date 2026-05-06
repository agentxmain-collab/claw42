import { generateLlmText } from "@/lib/llmFallbackChain";
import type { NewsItem, NewsSentiment } from "@/lib/types";
import type { NewsSourceId } from "@/lib/news/sourceRegistry";

interface NormalizedFields {
  sentiment?: NewsSentiment;
  currencies?: string[];
}

function missingFields(item: NewsItem): Array<"sentiment" | "currencies"> {
  const missing: Array<"sentiment" | "currencies"> = [];
  if (!item.sentiment || item.sentiment === "neutral") missing.push("sentiment");
  if (!item.currencies?.length) missing.push("currencies");
  return missing;
}

export function shouldNormalizeNewsItem(item: NewsItem) {
  return missingFields(item).length > 0;
}

function parseObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return JSON.parse(jsonText) as Record<string, unknown>;
}

function normalizeSentiment(value: unknown): NewsSentiment | undefined {
  if (value === "bullish" || value === "positive") return "bullish";
  if (value === "bearish" || value === "negative") return "bearish";
  if (value === "neutral") return "neutral";
  return undefined;
}

function normalizeCurrencies(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Array.from(
    new Set(
      value
        .map((item) => String(item).replace(/^\$/, "").toUpperCase().trim())
        .filter((item) => /^[A-Z0-9]{2,12}$/.test(item)),
    ),
  ).slice(0, 5);
}

function buildPrompt(item: NewsItem, missing: string[]) {
  return `You receive a crypto news headline. Return JSON ONLY, no prose.

Title: ${item.title}
Source: ${item.source}
URL: ${item.url}
Missing fields: ${missing.join(", ")}

Output:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "currencies": ["BTC" | "ETH" | "SOL" | "..."]
}

Rules:
- sentiment is based on likely crypto market impact, not editorial tone
- currencies: only include symbols explicitly mentioned or strongly implied
- max 5 currencies
- if uncertain and this is broad crypto market news, return ["BTC"]
- if no clear coin or market anchor, return []
- JSON only`;
}

export async function normalizeNewsItem(item: NewsItem, sourceId: NewsSourceId): Promise<NewsItem> {
  const missing = missingFields(item);
  if (missing.length === 0) return item;

  try {
    const result = await generateLlmText(buildPrompt(item, missing));
    if (!result) return item;

    const parsed = parseObject(result.text);
    const fields: NormalizedFields = {
      sentiment: normalizeSentiment(parsed.sentiment),
      currencies: normalizeCurrencies(parsed.currencies),
    };
    const next = {
      ...item,
      sentiment: fields.sentiment ?? item.sentiment,
      currencies: fields.currencies?.length ? fields.currencies : item.currencies,
    };

    console.info(
      JSON.stringify({
        type: "claw42_news_event",
        event: "news_normalizer_run",
        source_id: sourceId,
        missing_fields: missing,
      }),
    );
    return next;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[news] normalizer skipped", error);
    }
    return item;
  }
}
