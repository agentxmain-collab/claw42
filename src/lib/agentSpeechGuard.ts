import type {
  AgentId,
  SignalRecord,
  SignalSeverity,
  SignalType,
} from "@/modules/agent-watch/types";

export const AGENT_SPEECH_RATE_LIMIT_MS = 60_000;

const lastSpokeAt: Record<AgentId, number> = {
  alpha: 0,
  beta: 0,
  gamma: 0,
};

const AGENT_SIGNAL_MATCH: Record<AgentId, Set<SignalType>> = {
  alpha: new Set<SignalType>(["breakout", "near_high", "near_low", "volume_spike"]),
  beta: new Set<SignalType>(["ema_cross"]),
  gamma: new Set<SignalType>(["range_change", "near_high", "near_low"]),
};

const SEVERITY_WEIGHT: Record<SignalSeverity, number> = {
  info: 0,
  watch: 1,
  alert: 2,
};

export interface AgentSpeechDecision {
  agentId: AgentId;
  shouldSpeak: boolean;
  reason: string;
  triggerSignal?: SignalRecord;
  nextAllowedAt?: number;
}

function isSignalEligibleForAgent(agentId: AgentId, signal: SignalRecord): boolean {
  if (signal.severity === "info") return false;
  return AGENT_SIGNAL_MATCH[agentId].has(signal.type);
}

function sortSignalsByUrgency(a: SignalRecord, b: SignalRecord): number {
  const severityDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
  if (severityDiff !== 0) return severityDiff;
  return b.ts - a.ts;
}

export function checkAgentSpeech(
  agentId: AgentId,
  recentSignals: SignalRecord[],
  now = Date.now(),
): AgentSpeechDecision {
  const agentLastSpokeAt = lastSpokeAt[agentId] ?? 0;
  if (agentLastSpokeAt > 0 && now - agentLastSpokeAt < AGENT_SPEECH_RATE_LIMIT_MS) {
    return {
      agentId,
      shouldSpeak: false,
      reason: "rate_limit",
      nextAllowedAt: agentLastSpokeAt + AGENT_SPEECH_RATE_LIMIT_MS,
    };
  }

  const triggerSignal = recentSignals
    .filter((signal) => isSignalEligibleForAgent(agentId, signal))
    .sort(sortSignalsByUrgency)[0];

  if (!triggerSignal) {
    return {
      agentId,
      shouldSpeak: false,
      reason: "no_faction_signal",
    };
  }

  return {
    agentId,
    shouldSpeak: true,
    reason: `${triggerSignal.symbol}:${triggerSignal.type}:${triggerSignal.severity}`,
    triggerSignal,
  };
}

export function recordAgentSpoke(agentId: AgentId, ts = Date.now()) {
  lastSpokeAt[agentId] = ts;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[claw42] recordAgentSpoke ${agentId} ${new Date(ts).toISOString()}`);
  }
}
