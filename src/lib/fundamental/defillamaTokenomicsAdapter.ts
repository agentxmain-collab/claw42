import type { AnalystDataStatus } from "@/lib/team/strategyDecisionRecord";
import { fetchDefiLlamaProtocolEvidence } from "@/lib/onchain/defillamaAdapter";
import { resolveSymbolMapping } from "@/lib/team/symbolMapping";

export interface FundamentalEvidenceSnapshot {
  status: AnalystDataStatus;
  source: "defillama";
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  reason?: string;
  fetchedAt: string;
}

export async function fetchDefiLlamaFundamentalEvidence(
  symbol: string,
): Promise<FundamentalEvidenceSnapshot> {
  const mapping = resolveSymbolMapping(symbol);
  if (mapping.fallback.fundamentalMissing || !mapping.defillamaSlug) {
    return {
      status: "missing",
      source: "defillama",
      summary: `${mapping.symbol} fundamental data unavailable: protocol mapping is not configured.`,
      metrics: [],
      reason: "missing_slug",
      fetchedAt: new Date().toISOString(),
    };
  }

  const protocol = await fetchDefiLlamaProtocolEvidence(mapping.symbol);
  return {
    status: protocol.status,
    source: "defillama",
    summary: protocol.summary,
    metrics: protocol.metrics,
    reason: protocol.reason,
    fetchedAt: protocol.fetchedAt,
  };
}
