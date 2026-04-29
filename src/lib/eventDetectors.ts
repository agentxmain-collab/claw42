import type {
  AgentFocus,
  AgentId,
  CollectiveEvent,
  ConflictEvent,
  FocusEvent,
  SignalRecord,
  SignalType,
  StreamResponse,
} from "@/modules/agent-watch/types";

export const COLLECTIVE_EVENT_WINDOW_MS = 60_000;

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  volume_spike: "放量异动",
  near_high: "接近近期高位",
  near_low: "接近近期低位",
  breakout: "突破信号",
  ema_cross: "EMA 共振变化",
  range_change: "波动区间变化",
};

const MAJOR_SYMBOLS = new Set(["BTC", "ETH", "SOL"]);

type SignalDirection = "up" | "down" | "neutral";

function signalDirection(signal: SignalRecord): SignalDirection {
  if (signal.type === "near_high") return "up";
  if (signal.type === "near_low") return "down";
  if (signal.type === "range_change") {
    const change24h = signal.payload.change24h;
    if (typeof change24h === "number") return change24h >= 0 ? "up" : "down";
  }
  if (signal.type === "ema_cross") {
    if (signal.payload.emaState === "golden_cross" || signal.payload.emaState === "above") return "up";
    if (signal.payload.emaState === "dead_cross" || signal.payload.emaState === "below") return "down";
  }
  if (signal.type === "breakout") {
    const description = signal.payload.description ?? "";
    if (description.includes("跌破")) return "down";
    return "up";
  }
  return "neutral";
}

function eventId(kind: string, ts: number, parts: string[]) {
  const bucket = Math.floor(ts / COLLECTIVE_EVENT_WINDOW_MS);
  return `${kind}-${bucket}-${parts.join("-")}`;
}

function emptyResponse(agentId: AgentId): StreamResponse {
  return { agentId, content: "" };
}

function latestSignals(signals: SignalRecord[], now: number): SignalRecord[] {
  const cutoff = now - COLLECTIVE_EVENT_WINDOW_MS;
  return signals.filter((signal) => signal.ts >= cutoff);
}

export function detectCollectiveEvent(
  signals: SignalRecord[],
  now = Date.now(),
): CollectiveEvent | null {
  const groups = new Map<string, SignalRecord[]>();

  for (const signal of latestSignals(signals, now)) {
    if (!MAJOR_SYMBOLS.has(signal.symbol.toUpperCase())) continue;
    const direction = signalDirection(signal);
    if (direction === "neutral") continue;
    const key = `${signal.type}:${direction}`;
    groups.set(key, [...(groups.get(key) ?? []), signal]);
  }

  const candidates = Array.from(groups.entries())
    .map(([key, groupSignals]) => {
      const [signalType, direction] = key.split(":") as [SignalType, "up" | "down"];
      const symbols = Array.from(new Set(groupSignals.map((signal) => signal.symbol.toUpperCase())));
      return { signalType, direction, symbols, groupSignals };
    })
    .filter((item) => item.symbols.length >= 3)
    .sort((a, b) => {
      const latestA = Math.max(...a.groupSignals.map((signal) => signal.ts));
      const latestB = Math.max(...b.groupSignals.map((signal) => signal.ts));
      return latestB - latestA;
    });

  const candidate = candidates[0];
  if (!candidate) return null;

  return {
    kind: "collective_event",
    id: eventId("collective", now, [candidate.signalType, candidate.direction, ...candidate.symbols]),
    ts: now,
    symbols: candidate.symbols,
    direction: candidate.direction,
    signalType: candidate.signalType,
    description: `${candidate.symbols.join(" / ")} 60 秒内同时出现${
      SIGNAL_TYPE_LABELS[candidate.signalType]
    }，方向${candidate.direction === "up" ? "向上" : "向下"}。`,
    primaryResponse: emptyResponse("alpha"),
    echoResponses: [emptyResponse("beta"), emptyResponse("gamma")],
  };
}

export function detectFocusEvent(signals: SignalRecord[], now = Date.now()): FocusEvent | null {
  const focusSignal = latestSignals(signals, now)
    .filter((signal) => signal.severity === "alert")
    .sort((a, b) => b.ts - a.ts)[0];

  if (!focusSignal) return null;

  return {
    kind: "focus_event",
    id: eventId("focus", now, [focusSignal.symbol, focusSignal.type, focusSignal.id]),
    ts: now,
    symbol: focusSignal.symbol,
    signalType: focusSignal.type,
    severity: "alert",
    description:
      focusSignal.payload.description ??
      `${focusSignal.symbol} 出现${SIGNAL_TYPE_LABELS[focusSignal.type]}高优信号。`,
    primaryResponse: emptyResponse("alpha"),
  };
}

export function detectConflictEvent(focus: AgentFocus[], now = Date.now()): ConflictEvent | null {
  const bySymbol = new Map<string, AgentFocus[]>();
  for (const item of focus) {
    if (!item.symbol || item.symbol === "—") continue;
    bySymbol.set(item.symbol, [...(bySymbol.get(item.symbol) ?? []), item]);
  }

  for (const [symbol, items] of Array.from(bySymbol.entries())) {
    const agents = Array.from(new Set(items.map((item) => item.agentId)));
    if (agents.length < 2) continue;

    const hasMomentum = items.some(
      (item) => item.agentId === "alpha" || item.agentId === "beta",
    );
    const hasMeanReversion = items.some((item) => item.agentId === "gamma");
    if (!hasMomentum || !hasMeanReversion) continue;

    const first = agents[0] as AgentId;
    const second = agents.find((agentId) => agentId !== first) as AgentId | undefined;
    if (!second) continue;

    return {
      kind: "conflict_event",
      id: eventId("conflict", now, [symbol, first, second]),
      ts: now,
      symbol,
      description: `${symbol} 同时被趋势/突破视角和回归视角盯上，条件冲突需要拆开看。`,
      conflictingAgents: [first, second],
      responses: [emptyResponse(first), emptyResponse(second)],
    };
  }

  return null;
}
