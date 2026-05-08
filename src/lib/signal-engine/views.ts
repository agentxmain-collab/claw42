import { toAgentSignalPayload, type AgentSignalPayload } from "@/lib/signal-engine/agent-helpers";
import type { AssetBrief, MajorEventAnalysis, SignalCard } from "@/types/signal";

export type SignalView = "user" | "full" | "agent";
export type UserSignalPayload = Omit<SignalCard, "engine">;
export type SignalProjection = UserSignalPayload | SignalCard | AgentSignalPayload;

export function resolveSignalView(value: string | null): SignalView {
  return value === "user" || value === "agent" ? value : "full";
}

export function signalApiMeta(view: SignalView, meta: Record<string, unknown> = {}) {
  return {
    ...meta,
    apiVersion: "1.1",
    view,
  };
}

export function signalApiVersionMeta(meta: Record<string, unknown> = {}) {
  return {
    ...meta,
    apiVersion: "1.1",
  };
}

export function projectSignal(signal: SignalCard, view: "full"): SignalCard;
export function projectSignal(signal: SignalCard, view: "user"): UserSignalPayload;
export function projectSignal(signal: SignalCard, view: "agent"): AgentSignalPayload;
export function projectSignal(signal: SignalCard, view: SignalView): SignalProjection;
export function projectSignal(signal: SignalCard, view: SignalView): SignalProjection {
  if (view === "agent") return toAgentSignalPayload(signal);
  if (view === "user") return toUserSignal(signal);
  return signal;
}

export function projectSignals(signals: SignalCard[], view: SignalView) {
  return signals.map((signal) => projectSignal(signal, view));
}

export function projectAssetBrief(brief: AssetBrief, view: SignalView) {
  return {
    ...brief,
    relatedSignals: projectSignals(brief.relatedSignals, view),
  };
}

export function projectMajorEvent(majorEvent: MajorEventAnalysis, view: SignalView) {
  return {
    ...majorEvent,
    event: majorEvent.event ? projectSignal(majorEvent.event, view) : null,
  };
}

function toUserSignal(signal: SignalCard): UserSignalPayload {
  const { engine, ...userSignal } = signal;
  void engine;
  return userSignal;
}
