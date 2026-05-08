import type { SignalCard } from "@/types/signal";

const cacheTtlMs = 60 * 1000;
let cache: { signals: SignalCard[]; cachedAt: number } | null = null;

type SignalBuilder = () => SignalCard[] | Promise<SignalCard[]>;

export async function getCachedSignals(builder: SignalBuilder = defaultSignalBuilder) {
  if (cache && Date.now() - cache.cachedAt < cacheTtlMs) return cache.signals;
  const signals = await builder();
  cache = { signals, cachedAt: Date.now() };
  return signals;
}

export function clearSignalCache() {
  cache = null;
}

async function defaultSignalBuilder() {
  const { buildSignalsAsync } = await import("@/lib/signal-engine");
  return buildSignalsAsync();
}
