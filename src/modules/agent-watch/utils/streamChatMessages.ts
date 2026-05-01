import type {
  AgentId,
  CoinMarketContext,
  CoinPoolPayload,
  CoinTickerEntry,
  StreamResponse,
  StreamEntry,
} from "../types";
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

const FALLBACK_AGENT: Record<Exclude<StreamEntry["kind"], "agent_message" | "agent_discussion">, AgentId> = {
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

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "未形成";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : value >= 1 ? 4 : 6,
  });
}

function tickerForSymbol(pool: CoinPoolPayload | undefined, symbol: string): CoinTickerEntry | null {
  if (!pool) return null;
  const normalized = symbol.toUpperCase();
  return [...pool.majors, ...pool.trending, ...pool.opportunity]
    .find((ticker) => ticker.symbol.toUpperCase() === normalized) ?? null;
}

function contextForSymbol(pool: CoinPoolPayload | undefined, symbol: string): CoinMarketContext | null {
  if (!pool?.signals) return null;
  const normalized = symbol.toUpperCase();
  return Object.entries(pool.signals)
    .find(([key]) => key.toUpperCase() === normalized)?.[1] ?? null;
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
): AgentPointLevel[] {
  const [symbol] = symbols;
  if (!symbol) return [];

  const anchor = priceAnchor(pool, symbol);
  if (agentId === "alpha") {
    return [
      { label: "现价", value: formatPrice(anchor) },
      { label: "突破观察", value: formatPrice(levelFromContext(pool, symbol, "resistance") ?? derivedLevel(anchor, 1.018)) },
      { label: "回踩确认", value: formatPrice(anchor) },
      { label: "失效", value: formatPrice(levelFromContext(pool, symbol, "support") ?? derivedLevel(anchor, 0.982)) },
    ];
  }

  if (agentId === "beta") {
    return [
      { label: "现价", value: formatPrice(anchor) },
      { label: "趋势确认", value: formatPrice(levelFromContext(pool, symbol, "ema13") ?? derivedLevel(anchor, 1.012)) },
      { label: "EMA12", value: formatPrice(levelFromContext(pool, symbol, "ema12")) },
      { label: "结构失效", value: formatPrice(levelFromContext(pool, symbol, "support") ?? derivedLevel(anchor, 0.985)) },
    ];
  }

  return [
    { label: "现价", value: formatPrice(anchor) },
    { label: "近期低位", value: formatPrice(levelFromContext(pool, symbol, "low") ?? derivedLevel(anchor, 0.97)) },
    { label: "近期高位", value: formatPrice(levelFromContext(pool, symbol, "high") ?? derivedLevel(anchor, 1.03)) },
    { label: "回归确认", value: formatPrice(derivedLevel(anchor, 1.035)) },
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

function discussionSymbolsForResponse(
  entrySymbols: string[],
  response: StreamResponse,
): string[] {
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
}: {
  id: string;
  ts: number;
  agentId: AgentId;
  content: string;
  symbols: string[];
  tag?: string;
  pool?: CoinPoolPayload;
}): AgentChatMessage {
  const safeSymbols = uniqueSymbols(symbols);
  return {
    id,
    ts,
    agentId,
    content: prefixCoinSymbolsInText(content, safeSymbols),
    symbols: safeSymbols,
    tag,
    points: pointLevelsForAgent(agentId, safeSymbols, pool),
  };
}

export function buildStreamChatMessages(
  entry: StreamEntry,
  pool?: CoinPoolPayload,
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
        tag: "三方会诊",
        pool,
      }),
    );
  }

  if (entry.kind === "collective_event") {
    const responses = [entry.primaryResponse, ...entry.echoResponses]
      .filter((response) => response.content.trim().length > 0);
    const fallbackContent = `${entry.symbols.map(formatCoinSymbol).join(" / ")} 出现${SIGNAL_LABEL[entry.signalType]}，${entry.description}`;
    const source = responses.length > 0
      ? responses
      : [{ agentId: FALLBACK_AGENT.collective_event, content: fallbackContent }];
    return source.map((response) =>
      message({
        id: `${entry.id}-${response.agentId}`,
        ts: entry.ts,
        agentId: response.agentId,
        content: `${entry.description}。${response.content}`,
        symbols: entry.symbols,
        tag: "集体信号",
        pool,
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
        content: `${entry.description}。${prefixLeadingCoinSymbol(entry.primaryResponse.content, entry.symbol)}`,
        symbols: [entry.symbol],
        tag: "高优信号",
        pool,
      }),
    ];
  }

  if (entry.kind === "conflict_event") {
    const responses = entry.responses.filter((response) => response.content.trim().length > 0);
    const source = responses.length > 0
      ? responses
      : [{ agentId: FALLBACK_AGENT.conflict_event, content: entry.description }];
    return source.map((response) =>
      message({
        id: `${entry.id}-${response.agentId}`,
        ts: entry.ts,
        agentId: response.agentId,
        content: `${entry.description}。${prefixLeadingCoinSymbol(response.content, entry.symbol)}`,
        symbols: [entry.symbol],
        tag: "观点分歧",
        pool,
      }),
    );
  }

  return [
    message({
      id: `${entry.id}-watch`,
      ts: entry.ts,
      agentId: entry.agentId ?? FALLBACK_AGENT.watch_update,
      content: entry.content,
      symbols: entry.symbols?.length ? entry.symbols : entry.symbol ? [entry.symbol] : [],
      tag: entry.updateType === "agent_heartbeat" ? "巡检心跳" : entry.title,
      pool,
    }),
  ];
}
