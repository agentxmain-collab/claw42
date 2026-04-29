import type { AgentAnalysisPayload, MarketEventPayload, MarketTickerPayload } from "../types";

export async function fetchAgentAnalysis(signal?: AbortSignal): Promise<AgentAnalysisPayload> {
  const response = await fetch("/api/agents/analysis", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) throw new Error(`agent analysis ${response.status}`);
  return (await response.json()) as AgentAnalysisPayload;
}

export async function fetchMarketTicker(signal?: AbortSignal): Promise<MarketTickerPayload> {
  const response = await fetch("/api/market/ticker", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) throw new Error(`market ticker ${response.status}`);
  return (await response.json()) as MarketTickerPayload;
}

export async function fetchMarketEvents(
  signal?: AbortSignal,
  limit = 12,
): Promise<MarketEventPayload> {
  const response = await fetch(`/api/agents/events?limit=${limit}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) throw new Error(`market events ${response.status}`);
  return (await response.json()) as MarketEventPayload;
}
