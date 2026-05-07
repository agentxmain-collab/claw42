import type { AgentId, CoinPoolPayload, StreamResponse, StreamEntry } from "../types";
import type { AgentWatchLocale } from "../locale";
import { formatCoinSymbol, prefixCoinSymbolsInText, prefixLeadingCoinSymbol } from "./symbolFormat";

export interface AgentChatMessage {
  id: string;
  ts: number;
  agentId: AgentId;
  content: string;
  symbols: string[];
  tag?: string;
  marketDataFetchedAt?: number;
}

const FALLBACK_AGENT: Record<
  Exclude<
    StreamEntry["kind"],
    "agent_message" | "agent_discussion" | "news_debate" | "chat_thread"
  >,
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
  marketDataFetchedAt,
}: {
  id: string;
  ts: number;
  agentId: AgentId;
  content: string;
  symbols: string[];
  tag?: string;
  marketDataFetchedAt?: number;
}): AgentChatMessage {
  const safeSymbols = uniqueSymbols(symbols);
  return {
    id,
    ts,
    agentId,
    content: prefixCoinSymbolsInText(content, safeSymbols),
    symbols: safeSymbols,
    tag,
    marketDataFetchedAt,
  };
}

function joinDescription(locale: AgentWatchLocale, description: string, content: string): string {
  return locale === "en_US" ? content : `${description}。${content}`;
}

export function buildStreamChatMessages(
  entry: StreamEntry,
  _pool?: CoinPoolPayload,
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
        marketDataFetchedAt: entry.marketDataFetchedAt,
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
        marketDataFetchedAt: response.marketDataFetchedAt ?? entry.marketDataFetchedAt,
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
        marketDataFetchedAt: response.marketDataFetchedAt,
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
        marketDataFetchedAt: entry.primaryResponse.marketDataFetchedAt,
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
        marketDataFetchedAt: response.marketDataFetchedAt,
      }),
    );
  }

  if (entry.kind === "news_debate" || entry.kind === "chat_thread") return [];

  return [
    message({
      id: `${entry.id}-watch`,
      ts: entry.ts,
      agentId: entry.agentId ?? FALLBACK_AGENT.watch_update,
      content: entry.content,
      symbols: entry.symbols?.length ? entry.symbols : entry.symbol ? [entry.symbol] : [],
      tag: entry.updateType === "agent_heartbeat" ? TAG_COPY[locale].heartbeat : entry.title,
      marketDataFetchedAt: entry.marketDataFetchedAt,
    }),
  ];
}
