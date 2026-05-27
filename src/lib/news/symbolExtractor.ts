import type { NewsItem } from "@/lib/types";
import {
  getCoinWFuturesInstrumentSet,
  normalizeCoinWFuturesSymbol,
  type CoinWFuturesInstrumentSet,
} from "@/lib/coinw/futuresInstruments";
import type { TopicSelectionReason } from "@/lib/team/topicSelector";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";

export interface NewsDrivenCandidate {
  newsItem: NewsItem;
  symbol: string;
  candidate: DecisionCandidate;
}

const NEWS_DRIVEN_CANDIDATE_LIMIT = 3;

const CHINESE_SYMBOL_ALIASES: Array<[RegExp, string]> = [
  [/比特币|比特幣|大饼|大餅/g, "BTC"],
  [/以太坊|以太幣|以太币/g, "ETH"],
  [/索拉纳|索拉納/g, "SOL"],
  [/泰达币|泰達幣/g, "USDT"],
  [/瑞波币|瑞波幣/g, "XRP"],
  [/狗狗币|狗狗幣/g, "DOGE"],
  [/币安币|幣安幣/g, "BNB"],
  [/超流动|Hyperliquid/gi, "HYPE"],
];

const TOKEN_PATTERN = /\$?([A-Z0-9]{2,16})(?:_?USDT)?\b/g;

function stableNewsDrivenKey(item: NewsItem) {
  const sourceKey = `${item.id}:${item.url}:${item.title}`;
  return Buffer.from(sourceKey).toString("base64url").slice(0, 24);
}

function candidateReason(item: NewsItem): TopicSelectionReason {
  return {
    kind: "news",
    label: "news-driven",
    detail: item.title,
    score: 88,
  };
}

function symbolsFromText(text: string) {
  const matches: string[] = [];
  for (const [pattern, symbol] of CHINESE_SYMBOL_ALIASES) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) matches.push(symbol);
  }

  let match: RegExpExecArray | null = null;
  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(text))) {
    const normalized = normalizeCoinWFuturesSymbol(match[1]);
    if (normalized) matches.push(normalized);
  }
  return matches;
}

function aboutnessText(item: NewsItem) {
  return item.title;
}

function uniqueCoinwSymbols(symbols: readonly string[], instruments: CoinWFuturesInstrumentSet) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => normalizeCoinWFuturesSymbol(symbol))
        .filter((symbol): symbol is string => Boolean(symbol))
        .filter((symbol) => instruments.has(symbol)),
    ),
  );
}

export function extractSymbolsFromNewsText(
  item: NewsItem,
  instruments: CoinWFuturesInstrumentSet,
): string[] {
  const explicitSymbols = uniqueCoinwSymbols(symbolsFromText(aboutnessText(item)), instruments);
  if (explicitSymbols.length > 0) return explicitSymbols;

  const nativeSymbols = uniqueCoinwSymbols(
    Array.isArray(item.currencies) ? item.currencies : [],
    instruments,
  );
  if (nativeSymbols.length !== 1) return [];

  const normalizedTitle = item.title.toLowerCase();
  const [nativeSymbol] = nativeSymbols;
  if (!nativeSymbol) return [];
  if (normalizedTitle.includes(nativeSymbol.toLowerCase())) return [nativeSymbol];

  return [];
}

export function matchSingleSymbol(
  item: NewsItem,
  instruments: CoinWFuturesInstrumentSet,
): string | null {
  const symbols = extractSymbolsFromNewsText(item, instruments);
  return symbols.length === 1 ? symbols[0] : null;
}

export const newsToSymbol = matchSingleSymbol;

export function selectNewsDrivenCandidatesWithSymbolDiversity(
  candidates: NewsDrivenCandidate[],
  limit: number,
): NewsDrivenCandidate[] {
  if (limit <= 0 || candidates.length === 0) return [];

  const buckets = new Map<string, NewsDrivenCandidate[]>();
  for (const candidate of candidates) {
    const symbol = candidate.symbol.toUpperCase();
    const bucket = buckets.get(symbol);
    if (bucket) bucket.push(candidate);
    else buckets.set(symbol, [candidate]);
  }

  if (buckets.size <= 1) {
    if (candidates.length > 1) {
      console.info(
        JSON.stringify({
          type: "claw42_news_event",
          event: "same_symbol_diversification_unavailable",
          symbol: candidates[0]?.symbol ?? null,
          input_count: candidates.length,
          output_count: 1,
        }),
      );
    }
    return candidates.slice(0, Math.min(limit, 1));
  }

  const selected: NewsDrivenCandidate[] = [];
  while (selected.length < limit) {
    let added = false;
    for (const bucket of Array.from(buckets.values())) {
      const next = bucket.shift();
      if (!next) continue;
      selected.push(next);
      added = true;
      if (selected.length >= limit) break;
    }
    if (!added) break;
  }

  return selected;
}

export async function buildNewsDrivenCandidates({
  newsItems,
  limit = NEWS_DRIVEN_CANDIDATE_LIMIT,
  now = Date.now(),
  instruments,
}: {
  newsItems: NewsItem[];
  limit?: number;
  now?: number;
  instruments?: CoinWFuturesInstrumentSet;
}): Promise<NewsDrivenCandidate[]> {
  if (newsItems.length === 0) return [];
  const futuresInstruments = instruments ?? (await getCoinWFuturesInstrumentSet(now));
  const candidates: NewsDrivenCandidate[] = [];

  for (const newsItem of newsItems) {
    const symbol = matchSingleSymbol(newsItem, futuresInstruments);
    if (!symbol) continue;
    const instrument = futuresInstruments.get(symbol);
    if (!instrument) continue;
    const candidateKey = `news-driven:${symbol}:${stableNewsDrivenKey(newsItem)}`;
    const reasons = [candidateReason(newsItem)];
    candidates.push({
      newsItem,
      symbol,
      candidate: {
        candidateType: "symbol",
        candidateKey,
        symbol,
        displayTitle: `${symbol} 实时行情分析`,
        executable: true,
        cadence: "event",
        score: 95,
        reasons,
      },
    });
  }

  return selectNewsDrivenCandidatesWithSymbolDiversity(candidates, limit);
}
