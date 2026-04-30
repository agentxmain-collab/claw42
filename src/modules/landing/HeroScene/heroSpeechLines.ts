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
  primaryResponse?: HeroSpeechResponse;
  echoResponses?: HeroSpeechResponse[];
  responses?: HeroSpeechResponse[];
};

type HeroSpeechFocus = {
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

function signalBackedEntryLines(entry: HeroSpeechEntry): string[] {
  if (entry.kind === "agent_message" && entry.triggerSignalId && entry.content) {
    return [entry.content];
  }

  if (entry.kind === "collective_event") {
    return [entry.primaryResponse, ...(entry.echoResponses ?? [])]
      .map((response) => response?.content)
      .filter((content): content is string => Boolean(content));
  }

  if (entry.kind === "focus_event") {
    return entry.primaryResponse?.content ? [entry.primaryResponse.content] : [];
  }

  if (entry.kind === "conflict_event") {
    return (entry.responses ?? [])
      .map((response) => response.content)
      .filter((content): content is string => Boolean(content));
  }

  return [];
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function focusSupplementLines(data: HeroSpeechPayload): string[] {
  return (data.focus ?? []).flatMap((item) => [
    item.trigger?.description,
    item.judgment && !/(没信号|信号不足|还没有足够|等待信号)/.test(item.judgment)
      ? item.judgment
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
      return `${coin.symbol} 24h ${formatSignedPercent(change)}，${bias}`;
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
