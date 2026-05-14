import type { AgentAnalysisPayload, MarketEventPayload, MarketTickerPayload } from "../types";
import type { AgentWatchLocale } from "../locale";
import { apiPath } from "@/lib/basePath";

export async function fetchAgentAnalysis(
  signal?: AbortSignal,
  locale: AgentWatchLocale = "zh_CN",
): Promise<AgentAnalysisPayload> {
  const response = await fetch(
    apiPath(`/api/agents/analysis?locale=${locale}&pmTrigger=0&signalTrigger=0`),
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) throw new Error(`agent analysis ${response.status}`);
  return (await response.json()) as AgentAnalysisPayload;
}

export async function fetchMarketTicker(signal?: AbortSignal): Promise<MarketTickerPayload> {
  const response = await fetch(apiPath("/api/market/ticker?signalTrigger=0"), {
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
  const response = await fetch(apiPath(`/api/agents/events?limit=${limit}`), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) throw new Error(`market events ${response.status}`);
  return (await response.json()) as MarketEventPayload;
}
