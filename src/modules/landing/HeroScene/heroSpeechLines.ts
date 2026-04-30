import {
  formatCoinSymbol,
  normalizeCoinSymbol,
  prefixKnownLeadingSymbol,
} from "../../agent-watch/utils/symbolFormat";

type HeroSpeechMessage = {
  content?: string;
};

type HeroSpeechResponse = {
  content?: string;
};

type HeroSpeechEntry = {
  kind?: string;
  content?: string;
  triggerSignalId?: string;
  symbol?: string;
  symbols?: string[];
  primaryResponse?: HeroSpeechResponse;
  echoResponses?: HeroSpeechResponse[];
  responses?: HeroSpeechResponse[];
};

type HeroSpeechFocus = {
  symbol?: string;
  judgment?: string;
  trigger?: {
    description?: string;
  };
};

type HeroSpeechCoin = {
  symbol?: string;
  change24h?: number;
};

type HeroSpeechPool = {
  majors?: HeroSpeechCoin[];
  trending?: HeroSpeechCoin[];
  opportunity?: HeroSpeechCoin[];
};

type HeroSpeechPayload = {
  source?: string;
  stream?: HeroSpeechMessage[];
  streamEntries?: HeroSpeechEntry[];
  focus?: HeroSpeechFocus[];
  pool?: HeroSpeechPool;
};

export function cleanRobotAnalysisLine(content: string): string {
  const cleaned = content
    .replace(/\s+/g, " ")
    .replace(/^(触发|失效|趋势|动作|极端|边界)[：:]\s*/g, "")
    .trim();
  const [firstClause] = cleaned.split(/[。；;]/);
  const line = (firstClause || cleaned).trim();
  return Array.from(line).slice(0, 42).join("");
}

function uniqueUsableLines(lines: string[]): string[] {
  return Array.from(
    new Set(
      lines
        .map(cleanRobotAnalysisLine)
        .filter((line) => line.length >= 8),
    ),
  );
}

function lineWithSymbolContext(content: string, symbols: string[]): string {
  const normalizedSymbols = symbols.map(normalizeCoinSymbol).filter(Boolean);
  if (normalizedSymbols.length === 0) return content;

  const prefixed = prefixKnownLeadingSymbol(content, normalizedSymbols);
  if (prefixed !== content) return prefixed;

  const [primarySymbol] = normalizedSymbols;
  if (primarySymbol === "AI" && /^\s*\$?AI\s+Agent\b/i.test(content)) return content;

  const hasKnownSymbol = normalizedSymbols.some((symbol) => {
    const pattern = new RegExp(`(^|[^$A-Za-z0-9_])\\$?${symbol}(?=$|[^A-Za-z0-9_])`, "i");
    return pattern.test(content);
  });
  if (hasKnownSymbol) return content;

  return `${formatCoinSymbol(primarySymbol)} ${content}`;
}

function responseLinesWithContext(
  responses: Array<HeroSpeechResponse | undefined>,
  symbols: string[],
): string[] {
  return responses
    .map((response) => response?.content)
    .filter((content): content is string => Boolean(content))
    .map((content) => lineWithSymbolContext(content, symbols));
}

function signalBackedEntryLines(entry: HeroSpeechEntry): string[] {
  const symbols = entry.symbols?.length ? entry.symbols : entry.symbol ? [entry.symbol] : [];

  if (entry.kind === "agent_message" && entry.triggerSignalId && entry.content) {
    return [lineWithSymbolContext(entry.content, symbols)];
  }

  if (entry.kind === "collective_event") {
    return responseLinesWithContext([entry.primaryResponse, ...(entry.echoResponses ?? [])], symbols);
  }

  if (entry.kind === "focus_event") {
    return responseLinesWithContext([entry.primaryResponse], symbols);
  }

  if (entry.kind === "conflict_event") {
    return responseLinesWithContext(entry.responses ?? [], symbols);
  }

  return [];
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function focusSupplementLines(data: HeroSpeechPayload): string[] {
  return (data.focus ?? []).flatMap((item) => [
    item.trigger?.description
      ? lineWithSymbolContext(item.trigger.description, item.symbol ? [item.symbol] : [])
      : undefined,
    item.judgment && !/(没信号|信号不足|还没有足够|等待信号)/.test(item.judgment)
      ? lineWithSymbolContext(item.judgment, item.symbol ? [item.symbol] : [])
      : undefined,
  ]).filter((content): content is string => Boolean(content));
}

function poolSupplementLines(data: HeroSpeechPayload): string[] {
  const pool = data.pool;
  if (!pool) return [];

  const coins = [
    ...(pool.majors ?? []),
    ...(pool.trending ?? []),
    ...(pool.opportunity ?? []),
  ].filter((coin) => coin.symbol && Number.isFinite(coin.change24h));

  return coins
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
    .slice(0, 3)
    .map((coin) => {
      const change = coin.change24h ?? 0;
      const bias =
        Math.abs(change) >= 10
          ? "极端波动先等高低位失速"
          : change >= 0
            ? "强势延续看回踩能否守住"
            : "弱势先看近期低位能否止跌";
      return `${formatCoinSymbol(coin.symbol ?? "")} 24h ${formatSignedPercent(change)}，${bias}`;
    });
}

function supplementLines(data: HeroSpeechPayload): string[] {
  return uniqueUsableLines([
    ...focusSupplementLines(data),
    ...poolSupplementLines(data),
  ]);
}

export function buildHeroSpeechLines(
  data: HeroSpeechPayload | null | undefined,
  isZh: boolean,
): string[] | undefined {
  if (!isZh || !data) return undefined;

  const signalBackedLines = uniqueUsableLines(
    (data.streamEntries ?? []).flatMap(signalBackedEntryLines),
  );
  if (signalBackedLines.length > 0) {
    return Array.from(new Set([...signalBackedLines, ...supplementLines(data)])).slice(0, 5);
  }

  if (data.source === "static-fallback") return undefined;

  const streamLines = uniqueUsableLines((data.stream ?? []).map((message) => message.content ?? ""));
  const lines = Array.from(new Set([...streamLines, ...supplementLines(data)])).slice(0, 5);
  return lines.length > 0 ? lines : undefined;
}
