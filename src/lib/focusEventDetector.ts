import { getPrimaryAgentForSignalType } from "@/lib/agentViewGenerator";
import type {
  AgentCardView,
  AgentId,
  FocusEvent,
  SignalRecord,
} from "@/modules/agent-watch/types";

const AGENTS: AgentId[] = ["alpha", "beta", "gamma"];
const MAJOR_SYMBOLS = new Set(["BTC", "ETH", "SOL"]);
const COLLECTIVE_WINDOW_MS = 30_000;
const HIGH_SEVERITY_WINDOW_MS = 30_000;

const SIGNAL_TYPE_LABEL: Record<SignalRecord["type"], string> = {
  volume_spike: "放量异动",
  near_high: "接近近期高位",
  near_low: "接近近期低位",
  breakout: "突破信号",
  ema_cross: "EMA 共振变化",
  range_change: "波动区间变化",
};

const AGENT_NAME: Record<AgentId, string> = {
  alpha: "Alpha",
  beta: "Beta",
  gamma: "Gamma",
};

const BULLISH_TERMS = [
  "突破",
  "站稳",
  "放量",
  "多头",
  "共振",
  "反弹",
  "转强",
  "持有",
  "回踩不破",
];
const BEARISH_TERMS = [
  "跌破",
  "失守",
  "缩量",
  "空头",
  "假突破",
  "回落",
  "减仓",
  "走弱",
  "失效",
];

function recentSignals(signals: SignalRecord[], windowMs: number, now: number) {
  return signals
    .filter((signal) => now - signal.ts >= 0 && now - signal.ts <= windowMs)
    .sort((a, b) => b.ts - a.ts);
}

function uniqueSymbols(signals: SignalRecord[]): string[] {
  return Array.from(new Set(signals.map((signal) => signal.symbol.toUpperCase())));
}

function snippet(content: string, maxLength: number) {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function eventResponseFromView(view: AgentCardView, maxLength: number) {
  const trigger = view.trigger ? ` 触发：${view.trigger}` : "";
  return snippet(`${view.judgment}${trigger}`, maxLength);
}

function direction(content: string): "bullish" | "bearish" | "mixed" {
  const bullish = BULLISH_TERMS.some((term) => content.includes(term));
  const bearish = BEARISH_TERMS.some((term) => content.includes(term));
  if (bullish && !bearish) return "bullish";
  if (bearish && !bullish) return "bearish";
  return "mixed";
}

function makeEventId(type: FocusEvent["type"], parts: string[]) {
  return `${type}:${parts.sort().join("|")}`;
}

function buildEvent({
  type,
  ts,
  summary,
  primaryAgent,
  cardViews,
  signalIds,
  symbols,
}: {
  type: FocusEvent["type"];
  ts: number;
  summary: string;
  primaryAgent: AgentId;
  cardViews: Record<AgentId, AgentCardView>;
  signalIds: string[];
  symbols: string[];
}): FocusEvent {
  const primaryView = cardViews[primaryAgent];
  return {
    id: makeEventId(type, signalIds.length > 0 ? signalIds : symbols),
    type,
    ts,
    summary,
    primaryAgent,
    primaryContent: eventResponseFromView(primaryView, 150),
    echoes: AGENTS.filter((agentId) => agentId !== primaryAgent).map((agentId) => ({
      agentId,
      content: eventResponseFromView(cardViews[agentId], 56),
    })),
    signalIds,
    symbols,
  };
}

function detectCollectiveEvent(
  signals: SignalRecord[],
  cardViews: Record<AgentId, AgentCardView>,
): FocusEvent | null {
  const byType = new Map<SignalRecord["type"], SignalRecord[]>();
  for (const signal of signals) {
    const current = byType.get(signal.type) ?? [];
    current.push(signal);
    byType.set(signal.type, current);
  }

  const candidates = Array.from(byType.entries())
    .map(([type, items]) => ({ type, items, symbols: uniqueSymbols(items) }))
    .filter((entry) => entry.symbols.length >= 3)
    .sort((a, b) => b.items.length - a.items.length);

  const selected = candidates[0];
  if (!selected) return null;

  const primaryAgent = getPrimaryAgentForSignalType(selected.type);
  const signalIds = selected.items.map((signal) => signal.id);
  const symbols = selected.symbols;
  return buildEvent({
    type: "collective",
    ts: selected.items[0]?.ts ?? Date.now(),
    summary: `${symbols.join("/")} 同时出现${SIGNAL_TYPE_LABEL[selected.type]}，市场进入同类信号共振。`,
    primaryAgent,
    cardViews,
    signalIds,
    symbols,
  });
}

function detectHighSeverityEvent(
  signals: SignalRecord[],
  cardViews: Record<AgentId, AgentCardView>,
): FocusEvent | null {
  const selected = signals.find(
    (signal) => signal.severity === "alert" && MAJOR_SYMBOLS.has(signal.symbol.toUpperCase()),
  );
  if (!selected) return null;

  const primaryAgent = getPrimaryAgentForSignalType(selected.type);
  return buildEvent({
    type: "high_severity",
    ts: selected.ts,
    summary:
      selected.payload.description ??
      `${selected.symbol} 出现${SIGNAL_TYPE_LABEL[selected.type]}，进入高优先级观察。`,
    primaryAgent,
    cardViews,
    signalIds: [selected.id],
    symbols: [selected.symbol.toUpperCase()],
  });
}

function detectFactionConflict(cardViews: Record<AgentId, AgentCardView>): FocusEvent | null {
  const views = AGENTS.map((agentId) => cardViews[agentId]).filter(Boolean);
  const bySymbol = new Map<string, AgentCardView[]>();

  for (const view of views) {
    const symbol = view.currentSymbol.toUpperCase();
    if (!symbol || symbol === "—") continue;
    const current = bySymbol.get(symbol) ?? [];
    current.push(view);
    bySymbol.set(symbol, current);
  }

  for (const [symbol, symbolViews] of Array.from(bySymbol.entries())) {
    if (symbolViews.length < 2) continue;
    const withDirections = symbolViews.map((view) => ({
      view,
      direction: direction(`${view.judgment} ${view.trigger} ${view.invalidation}`),
    }));
    const bullish = withDirections.find((item) => item.direction === "bullish");
    const bearish = withDirections.find((item) => item.direction === "bearish");
    if (!bullish || !bearish) continue;

    const primaryAgent = bullish.view.status === "alert" ? bullish.view.agentId : bearish.view.agentId;
    const participants = [bullish.view.agentId, bearish.view.agentId].map((agentId) => AGENT_NAME[agentId]);
    return buildEvent({
      type: "faction_conflict",
      ts: Math.max(...symbolViews.map((view) => view.lastUpdateAt)),
      summary: `${symbol} 出现派别分歧，${participants.join(" / ")} 给出相反观察。`,
      primaryAgent,
      cardViews,
      signalIds: symbolViews.flatMap((view) => view.evidenceSignalIds),
      symbols: [symbol],
    });
  }

  return null;
}

export function detectFocusEvent(
  signals: SignalRecord[],
  cardViews: Record<AgentId, AgentCardView>,
  now = Date.now(),
): FocusEvent | null {
  const collectiveSignals = recentSignals(signals, COLLECTIVE_WINDOW_MS, now);
  const collective = detectCollectiveEvent(collectiveSignals, cardViews);
  if (collective) return collective;

  const highSeveritySignals = recentSignals(signals, HIGH_SEVERITY_WINDOW_MS, now);
  const highSeverity = detectHighSeverityEvent(highSeveritySignals, cardViews);
  if (highSeverity) return highSeverity;

  return detectFactionConflict(cardViews);
}
