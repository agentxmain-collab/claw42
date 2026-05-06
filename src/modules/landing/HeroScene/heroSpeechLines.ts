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
  heroBubbles?: string[];
};

type HeroSpeechLocale = "zh_CN" | "en_US";

function normalizeHeroSpeechLocale(locale: boolean | HeroSpeechLocale): HeroSpeechLocale {
  if (locale === true) return "zh_CN";
  if (locale === false) return "en_US";
  return locale;
}

function trimLineAtBoundary(line: string, limit: number): string {
  const chars = Array.from(line);
  if (chars.length <= limit) return line;

  const withoutTrailingParenthetical = line
    .replace(/\s*[（(][^）)]*[）)]\s*$/, "")
    .replace(/\s*[（(][^）)]*$/, "")
    .trim();
  if (
    withoutTrailingParenthetical &&
    withoutTrailingParenthetical !== line &&
    Array.from(withoutTrailingParenthetical).length >= 8
  ) {
    return withoutTrailingParenthetical;
  }

  const limited = chars.slice(0, limit).join("").trim();
  const boundary = Math.max(
    limited.lastIndexOf("。"),
    limited.lastIndexOf("；"),
    limited.lastIndexOf(";"),
    limited.lastIndexOf("，"),
    limited.lastIndexOf(","),
  );

  if (boundary >= Math.min(18, Math.floor(limit * 0.45))) {
    return limited.slice(0, boundary).trim();
  }

  return limited.replace(/\s*[（(][^）)]*$/, "").trim();
}

export function cleanRobotAnalysisLine(
  content: string,
  locale: HeroSpeechLocale = "zh_CN",
): string {
  const cleaned = content
    .replace(/\s+/g, " ")
    .replace(/^(触发|失效|趋势|动作|极端|边界)[：:]\s*/g, "")
    .replace(/^(trigger|invalid|trend|action|extreme|boundary)\s*[:：]\s*/gi, "")
    .trim();
  const [firstClause] = cleaned.split(/[。；;]/);
  const line = (firstClause || cleaned).trim();
  return trimLineAtBoundary(line, locale === "en_US" ? 88 : 56);
}

function uniqueUsableLines(lines: string[], locale: HeroSpeechLocale): string[] {
  return Array.from(
    new Set(
      lines
        .map((line) => cleanRobotAnalysisLine(line, locale))
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

function poolSupplementLines(data: HeroSpeechPayload, locale: HeroSpeechLocale): string[] {
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
      if (locale === "en_US") {
        const bias =
          Math.abs(change) >= 10
            ? "extreme move; wait for high-low exhaustion"
            : change >= 0
              ? "strength needs a held pullback"
              : "weakness first; watch whether the recent low holds";
        return `${formatCoinSymbol(coin.symbol ?? "")} 24h ${formatSignedPercent(change)}; ${bias}`;
      }

      const bias =
        Math.abs(change) >= 10
          ? "极端波动先等高低位失速"
          : change >= 0
            ? "强势延续看回踩能否守住"
            : "弱势先看近期低位能否止跌";
      return `${formatCoinSymbol(coin.symbol ?? "")} 24h ${formatSignedPercent(change)}，${bias}`;
    });
}

function supplementLines(data: HeroSpeechPayload, locale: HeroSpeechLocale): string[] {
  return uniqueUsableLines(
    [...focusSupplementLines(data), ...poolSupplementLines(data, locale)],
    locale,
  );
}

export function buildHeroSpeechLines(
  data: HeroSpeechPayload | null | undefined,
  localeInput: boolean | HeroSpeechLocale,
): string[] | undefined {
  if (!data) return undefined;

  const locale = normalizeHeroSpeechLocale(localeInput);

  const signalBackedLines = uniqueUsableLines(
    (data.streamEntries ?? []).flatMap(signalBackedEntryLines),
    locale,
  );
  if (signalBackedLines.length > 0) {
    return Array.from(new Set([...signalBackedLines, ...supplementLines(data, locale)])).slice(0, 5);
  }

  const streamLines = uniqueUsableLines(
    (data.stream ?? []).map((message) => message.content ?? ""),
    locale,
  );
  const heroBubbleLines = uniqueUsableLines(data.heroBubbles ?? [], locale);
  const lines = Array.from(
    new Set([...streamLines, ...supplementLines(data, locale), ...heroBubbleLines]),
  ).slice(0, 5);
  return lines.length > 0 ? lines : undefined;
}

function cleanLinePool(lines: string[] | undefined): string[] {
  return Array.from(
    new Set((lines ?? []).map((line) => line.trim()).filter(Boolean)),
  );
}

export function mergeHeroSpeechLinePools(
  liveLines: string[] | undefined,
  scriptLines: string[] | undefined,
  includeScripts: boolean,
): string[] | undefined {
  const livePool = cleanLinePool(liveLines);
  if (!includeScripts) return livePool.length > 0 ? livePool : undefined;

  const scriptPool = cleanLinePool(scriptLines).slice(
    0,
    Math.max(3, livePool.length || 3),
  );

  const merged: string[] = [];
  const maxLength = Math.max(livePool.length, scriptPool.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (livePool[index]) merged.push(livePool[index]);
    if (scriptPool[index]) merged.push(scriptPool[index]);
  }

  const result = cleanLinePool(merged);
  return result.length > 0 ? result : undefined;
}
