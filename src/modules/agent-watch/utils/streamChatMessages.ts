import type {
  AgentId,
  CoinMarketContext,
  CoinPoolPayload,
  CoinTickerEntry,
  StreamResponse,
  StreamEntry,
} from "../types";
import type { AgentWatchLocale } from "../locale";
import { formatCoinSymbol, prefixCoinSymbolsInText, prefixLeadingCoinSymbol } from "./symbolFormat";

export interface AgentPointLevel {
  label: string;
  value: string;
}

export interface AgentChatMessage {
  id: string;
  ts: number;
  agentId: AgentId;
  content: string;
  symbols: string[];
  tag?: string;
  points: AgentPointLevel[];
}

const FALLBACK_AGENT: Record<
  Exclude<StreamEntry["kind"], "agent_message" | "agent_discussion" | "news_debate">,
  AgentId
> = {
  collective_event: "beta",
  focus_event: "gamma",
  conflict_event: "alpha",
  watch_update: "beta",
};

const SIGNAL_LABEL = {
  volume_spike: "放量异动",
  near_high: "接近近期高位",
  near_low: "接近近期低位",
  breakout: "突破信号",
  ema_cross: "EMA 共振",
  range_change: "波动区间变化",
} as const;

const SIGNAL_LABEL_EN: Record<keyof typeof SIGNAL_LABEL, string> = {
  volume_spike: "volume spike",
  near_high: "near recent high",
  near_low: "near recent low",
  breakout: "breakout signal",
  ema_cross: "EMA resonance",
  range_change: "range change",
};

const POINT_LABELS: Record<AgentWatchLocale, Record<AgentId, string[]>> = {
  zh_CN: {
    alpha: ["现价", "突破观察", "回踩确认", "失效"],
    beta: ["现价", "趋势确认", "EMA12", "结构失效"],
    gamma: ["现价", "近期低位", "近期高位", "回归确认"],
  },
  en_US: {
    alpha: ["Current", "Breakout watch", "Retest confirm", "Invalidation"],
    beta: ["Current", "Trend confirm", "EMA12", "Structure invalid"],
    gamma: ["Current", "Recent low", "Recent high", "Reversion confirm"],
  },
};

const TAG_COPY: Record<AgentWatchLocale, Record<string, string>> = {
  zh_CN: {
    discussion: "三方会诊",
    collective: "集体信号",
    focus: "高优信号",
    conflict: "观点分歧",
    heartbeat: "巡检心跳",
  },
  en_US: {
    discussion: "Agent huddle",
    collective: "Collective signal",
    focus: "High-priority signal",
    conflict: "View conflict",
    heartbeat: "Agent check-in",
  },
};

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "未形成";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 4 : 6,
  });
}

function formatPointPrice(value: number | null | undefined, locale: AgentWatchLocale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return locale === "en_US" ? "Not formed" : "未形成";
  }
  return formatPrice(value);
}

function tickerForSymbol(
  pool: CoinPoolPayload | undefined,
  symbol: string,
): CoinTickerEntry | null {
  if (!pool) return null;
  const normalized = symbol.toUpperCase();
  return (
    [...pool.majors, ...pool.trending, ...pool.opportunity].find(
      (ticker) => ticker.symbol.toUpperCase() === normalized,
    ) ?? null
  );
}

function contextForSymbol(
  pool: CoinPoolPayload | undefined,
  symbol: string,
): CoinMarketContext | null {
  if (!pool?.signals) return null;
  const normalized = symbol.toUpperCase();
  return (
    Object.entries(pool.signals).find(([key]) => key.toUpperCase() === normalized)?.[1] ?? null
  );
}

function priceAnchor(pool: CoinPoolPayload | undefined, symbol: string): number | null {
  const ticker = tickerForSymbol(pool, symbol);
  if (ticker && Number.isFinite(ticker.price)) return ticker.price;

  const context = contextForSymbol(pool, symbol);
  return context?.m5?.latestClose ?? context?.m15?.latestClose ?? context?.h4?.latestClose ?? null;
}

function levelFromContext(
  pool: CoinPoolPayload | undefined,
  symbol: string,
  pick: "support" | "resistance" | "low" | "high" | "ema12" | "ema13",
): number | null {
  const context = contextForSymbol(pool, symbol);
  const frame = context?.m15 ?? context?.m5 ?? context?.h4 ?? null;
  if (!frame) return null;
  return frame[pick] ?? null;
}

function derivedLevel(anchor: number | null, multiplier: number): number | null {
  return anchor === null ? null : anchor * multiplier;
}

function pointLevelsForAgent(
  agentId: AgentId,
  symbols: string[],
  pool?: CoinPoolPayload,
  locale: AgentWatchLocale = "zh_CN",
): AgentPointLevel[] {
  const [symbol] = symbols;
  if (!symbol) return [];

  const anchor = priceAnchor(pool, symbol);
  const labels = POINT_LABELS[locale][agentId];
  if (agentId === "alpha") {
    return [
      { label: labels[0], value: formatPointPrice(anchor, locale) },
      {
        label: labels[1],
        value: formatPointPrice(
          levelFromContext(pool, symbol, "resistance") ?? derivedLevel(anchor, 1.018),
          locale,
        ),
      },
      { label: labels[2], value: formatPointPrice(anchor, locale) },
      {
        label: labels[3],
        value: formatPointPrice(
          levelFromContext(pool, symbol, "support") ?? derivedLevel(anchor, 0.982),
          locale,
        ),
      },
    ];
  }

  if (agentId === "beta") {
    return [
      { label: labels[0], value: formatPointPrice(anchor, locale) },
      {
        label: labels[1],
        value: formatPointPrice(
          levelFromContext(pool, symbol, "ema13") ?? derivedLevel(anchor, 1.012),
          locale,
        ),
      },
      {
        label: labels[2],
        value: formatPointPrice(levelFromContext(pool, symbol, "ema12"), locale),
      },
      {
        label: labels[3],
        value: formatPointPrice(
          levelFromContext(pool, symbol, "support") ?? derivedLevel(anchor, 0.985),
          locale,
        ),
      },
    ];
  }

  return [
    { label: labels[0], value: formatPointPrice(anchor, locale) },
    {
      label: labels[1],
      value: formatPointPrice(
        levelFromContext(pool, symbol, "low") ?? derivedLevel(anchor, 0.97),
        locale,
      ),
    },
    {
      label: labels[2],
      value: formatPointPrice(
        levelFromContext(pool, symbol, "high") ?? derivedLevel(anchor, 1.03),
        locale,
      ),
    },
    { label: labels[3], value: formatPointPrice(derivedLevel(anchor, 1.035), locale) },
  ];
}

function uniqueSymbols(symbols: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const symbol of symbols) {
    const normalized = symbol?.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function discussionSymbolsForResponse(entrySymbols: string[], response: StreamResponse): string[] {
  const mentionedSymbol = entrySymbols.find((symbol) =>
    response.content.includes(formatCoinSymbol(symbol)),
  );
  return uniqueSymbols([response.symbol, mentionedSymbol, entrySymbols[0]]).slice(0, 1);
}

function message({
  id,
  ts,
  agentId,
  content,
  symbols,
  tag,
  pool,
  locale = "zh_CN",
}: {
  id: string;
  ts: number;
  agentId: AgentId;
  content: string;
  symbols: string[];
  tag?: string;
  pool?: CoinPoolPayload;
  locale?: AgentWatchLocale;
}): AgentChatMessage {
  const safeSymbols = uniqueSymbols(symbols);
  return {
    id,
    ts,
    agentId,
    content: prefixCoinSymbolsInText(content, safeSymbols),
    symbols: safeSymbols,
    tag,
    points: pointLevelsForAgent(agentId, safeSymbols, pool, locale),
  };
}

function joinDescription(locale: AgentWatchLocale, description: string, content: string): string {
  return locale === "en_US" ? content : `${description}。${content}`;
}

export function buildStreamChatMessages(
  entry: StreamEntry,
  pool?: CoinPoolPayload,
  locale: AgentWatchLocale = "zh_CN",
): AgentChatMessage[] {
  if (entry.kind === "agent_message") {
    return [
      message({
        id: `${entry.id}-chat`,
        ts: entry.ts,
        agentId: entry.agentId,
        content: entry.content,
        symbols: entry.symbols?.length ? entry.symbols : entry.symbol ? [entry.symbol] : [],
        pool,
        locale,
      }),
    ];
  }

  if (entry.kind === "agent_discussion") {
    return entry.responses.map((response) =>
      message({
        id: `${entry.id}-${response.agentId}`,
        ts: entry.ts,
        agentId: response.agentId,
        content: response.content,
        symbols: discussionSymbolsForResponse(entry.symbols, response),
        tag: TAG_COPY[locale].discussion,
        pool,
        locale,
      }),
    );
  }

  if (entry.kind === "collective_event") {
    const responses = [entry.primaryResponse, ...entry.echoResponses].filter(
      (response) => response.content.trim().length > 0,
    );
    const fallbackContent =
      locale === "en_US"
        ? `${entry.symbols.map(formatCoinSymbol).join(" / ")} show ${SIGNAL_LABEL_EN[entry.signalType]}.`
        : `${entry.symbols.map(formatCoinSymbol).join(" / ")} 出现${SIGNAL_LABEL[entry.signalType]}，${entry.description}`;
    const source =
      responses.length > 0
        ? responses
        : [{ agentId: FALLBACK_AGENT.collective_event, content: fallbackContent }];
    return source.map((response) =>
      message({
        id: `${entry.id}-${response.agentId}`,
        ts: entry.ts,
        agentId: response.agentId,
        content: joinDescription(locale, entry.description, response.content),
        symbols: entry.symbols,
        tag: TAG_COPY[locale].collective,
        pool,
        locale,
      }),
    );
  }

  if (entry.kind === "focus_event") {
    const agentId = entry.primaryResponse.agentId || FALLBACK_AGENT.focus_event;
    return [
      message({
        id: `${entry.id}-${agentId}`,
        ts: entry.ts,
        agentId,
        content: joinDescription(
          locale,
          entry.description,
          prefixLeadingCoinSymbol(entry.primaryResponse.content, entry.symbol),
        ),
        symbols: [entry.symbol],
        tag: TAG_COPY[locale].focus,
        pool,
        locale,
      }),
    ];
  }

  if (entry.kind === "conflict_event") {
    const responses = entry.responses.filter((response) => response.content.trim().length > 0);
    const source =
      responses.length > 0
        ? responses
        : [{ agentId: FALLBACK_AGENT.conflict_event, content: entry.description }];
    return source.map((response) =>
      message({
        id: `${entry.id}-${response.agentId}`,
        ts: entry.ts,
        agentId: response.agentId,
        content: joinDescription(
          locale,
          entry.description,
          prefixLeadingCoinSymbol(response.content, entry.symbol),
        ),
        symbols: [entry.symbol],
        tag: TAG_COPY[locale].conflict,
        pool,
        locale,
      }),
    );
  }

  if (entry.kind === "news_debate") return [];

  return [
    message({
      id: `${entry.id}-watch`,
      ts: entry.ts,
      agentId: entry.agentId ?? FALLBACK_AGENT.watch_update,
      content: entry.content,
      symbols: entry.symbols?.length ? entry.symbols : entry.symbol ? [entry.symbol] : [],
      tag: entry.updateType === "agent_heartbeat" ? TAG_COPY[locale].heartbeat : entry.title,
      pool,
      locale,
    }),
  ];
}
