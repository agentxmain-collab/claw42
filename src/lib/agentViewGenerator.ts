import type {
  AgentAnalysisPayload,
  AgentCardStatus,
  AgentCardView,
  AgentFocus,
  AgentId,
  SignalRecord,
  StreamMessage,
} from "@/modules/agent-watch/types";

const AGENTS: AgentId[] = ["alpha", "beta", "gamma"];
const RECENT_OBSERVING_WINDOW_MS = 5 * 60_000;
const SPEAKING_WINDOW_MS = 60_000;
const UPDATE_RATE_LIMIT_MS = 60_000;
const ALERT_SIGNAL_THRESHOLD = 3;

const FACTION_SIGNAL_ROUTES: Record<AgentId, SignalRecord["type"][]> = {
  alpha: ["breakout", "near_high", "near_low"],
  beta: ["ema_cross", "volume_spike"],
  gamma: ["range_change"],
};

const FALLBACK_COPY: Record<AgentId, { symbol: string; judgment: string; trigger: string; invalidation: string }> = {
  alpha: {
    symbol: "BTC",
    judgment: "Alpha 等待突破信号，未见放量确认前不追。",
    trigger: "出现放量突破、回踩不破后更新判断。",
    invalidation: "跌回关键区间或缩量冲高，突破判断失效。",
  },
  beta: {
    symbol: "ETH",
    judgment: "Beta 观察趋势结构，EMA 共振不清晰时保持克制。",
    trigger: "EMA12/13 重新共振且价格不回落后更新判断。",
    invalidation: "跌回 EMA13 下方，趋势判断降级。",
  },
  gamma: {
    symbol: "SOL",
    judgment: "Gamma 等待极端波动后的回归窗口，没到位置不接飞刀。",
    trigger: "24h 极端涨跌靠近近期高低位后更新判断。",
    invalidation: "波动区间继续扩大并脱离锚点，回归判断失效。",
  },
};

type AgentCardViewMap = Record<AgentId, AgentCardView>;

export function matchesFaction(agentId: AgentId, signalType: SignalRecord["type"]): boolean {
  return FACTION_SIGNAL_ROUTES[agentId].includes(signalType);
}

export function getPrimaryAgentForSignalType(signalType: SignalRecord["type"]): AgentId {
  return AGENTS.find((agentId) => matchesFaction(agentId, signalType)) ?? "alpha";
}

function severityRank(severity: SignalRecord["severity"]): number {
  if (severity === "alert") return 2;
  if (severity === "watch") return 1;
  return 0;
}

function sortedSignals(signals: SignalRecord[]): SignalRecord[] {
  return [...signals].sort((a, b) => b.ts - a.ts || severityRank(b.severity) - severityRank(a.severity));
}

function recentSignalsForAgent(agentId: AgentId, signals: SignalRecord[], now: number) {
  const cutoff = now - RECENT_OBSERVING_WINDOW_MS;
  return sortedSignals(
    signals.filter((signal) => signal.ts >= cutoff && matchesFaction(agentId, signal.type)),
  );
}

function evidenceForFocus(focus: AgentFocus | null, signals: SignalRecord[]) {
  if (!focus) return [];
  return sortedSignals(signals)
    .filter(
      (signal) =>
        signal.symbol.toUpperCase() === focus.symbol.toUpperCase() &&
        signal.ts <= focus.generatedAt + 5_000,
    )
    .slice(0, 4)
    .map((signal) => signal.id);
}

function latestMatchingEvidence(agentId: AgentId, signals: SignalRecord[]) {
  return sortedSignals(signals)
    .filter((signal) => matchesFaction(agentId, signal.type) && signal.severity !== "info")
    .slice(0, 4);
}

function shouldKeepPreviousView(
  previous: AgentCardView | undefined,
  latestSignal: SignalRecord | undefined,
  now: number,
) {
  if (!previous || !latestSignal) return false;
  if (latestSignal.severity === "info") return true;
  return now - previous.lastUpdateAt < UPDATE_RATE_LIMIT_MS;
}

function statusForAgent(agentId: AgentId, view: AgentCardView, signals: SignalRecord[], now: number): AgentCardStatus {
  const recent = recentSignalsForAgent(agentId, signals, now);
  const alertCount = recent.filter((signal) => signal.severity === "alert").length;

  if (alertCount >= ALERT_SIGNAL_THRESHOLD) return "alert";
  if (now - view.lastUpdateAt < SPEAKING_WINDOW_MS) return "speaking";
  if (recent.some((signal) => signal.severity !== "alert")) return "observing";
  return "silent";
}

function streamFallback(agentId: AgentId, stream?: StreamMessage[]) {
  return stream?.find((item) => item.agentId === agentId)?.content;
}

function buildViewFromFocus({
  agentId,
  focus,
  stream,
  signals,
  generatedAt,
  now,
}: {
  agentId: AgentId;
  focus: AgentFocus | null;
  stream?: StreamMessage[];
  signals: SignalRecord[];
  generatedAt?: number;
  now: number;
}): AgentCardView {
  const latestEvidence = latestMatchingEvidence(agentId, signals);
  const firstSignal = latestEvidence[0];
  const fallback = FALLBACK_COPY[agentId];
  const currentSymbol = focus?.symbol ?? firstSignal?.symbol ?? fallback.symbol;
  const lastUpdateAt = focus?.generatedAt ?? generatedAt ?? firstSignal?.ts ?? now;
  const judgment = focus?.judgment ?? streamFallback(agentId, stream) ?? fallback.judgment;
  const trigger = focus?.trigger.description ?? firstSignal?.payload.description ?? fallback.trigger;
  const invalidation = focus?.fail.description ?? fallback.invalidation;
  const evidenceSignalIds = focus
    ? evidenceForFocus(focus, signals)
    : latestEvidence.map((signal) => signal.id);

  const view: AgentCardView = {
    agentId,
    status: "silent",
    currentSymbol,
    judgment,
    trigger,
    invalidation,
    lastUpdateAt,
    evidenceSignalIds,
  };

  return {
    ...view,
    status: statusForAgent(agentId, view, signals, now),
  };
}

export function deriveAgentCardViews({
  analysis,
  signals,
  previousViews,
  now = Date.now(),
}: {
  analysis: AgentAnalysisPayload | null;
  signals: SignalRecord[];
  previousViews?: Partial<AgentCardViewMap>;
  now?: number;
}): AgentCardViewMap {
  return AGENTS.reduce((views, agentId) => {
    const latestSignal = latestMatchingEvidence(agentId, signals)[0];
    const previous = previousViews?.[agentId];

    if (previous && shouldKeepPreviousView(previous, latestSignal, now)) {
      views[agentId] = {
        ...previous,
        status: statusForAgent(agentId, previous, signals, now),
      };
      return views;
    }

    const focus = analysis?.focus?.find((item) => item.agentId === agentId) ?? null;
    views[agentId] = buildViewFromFocus({
      agentId,
      focus,
      stream: analysis?.stream,
      signals,
      generatedAt: analysis?.generatedAt,
      now,
    });
    return views;
  }, {} as AgentCardViewMap);
}
