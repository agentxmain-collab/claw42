import type { AnalystDataStatus } from "@/lib/team/strategyDecisionRecord";
import { resolveSymbolMapping } from "@/lib/team/symbolMapping";

export interface OnchainEvidenceSnapshot {
  status: AnalystDataStatus;
  source: "etherscan";
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  reason?: string;
  fetchedAt: string;
}

function missing(symbol: string, reason: string): OnchainEvidenceSnapshot {
  return {
    status: "missing",
    source: "etherscan",
    summary: `${symbol} onchain data unavailable: ${reason}`,
    metrics: [],
    reason,
    fetchedAt: new Date().toISOString(),
  };
}

function etherscanApiBase(chain: string | null | undefined) {
  if (chain === "bsc") return "https://api.bscscan.com/api";
  return "https://api.etherscan.io/api";
}

export async function fetchEtherscanEvidence(symbol: string): Promise<OnchainEvidenceSnapshot> {
  const mapping = resolveSymbolMapping(symbol);
  if (mapping.fallback.onchainMissing)
    return missing(mapping.symbol, "symbol mapping has no onchain source");
  if (!mapping.contract) return missing(mapping.symbol, "token contract not configured");

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey?.trim()) return missing(mapping.symbol, "ETHERSCAN_API_KEY is not configured");

  const params = new URLSearchParams({
    module: "stats",
    action: "tokensupply",
    contractaddress: mapping.contract,
    apikey: apiKey,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${etherscanApiBase(mapping.chain)}?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`etherscan ${response.status}`);
    const payload = (await response.json()) as { result?: unknown; message?: string };
    const supply = typeof payload.result === "string" ? payload.result : undefined;
    if (!supply || payload.message === "NOTOK") {
      return missing(mapping.symbol, payload.message || "no token supply returned");
    }

    return {
      status: "ok",
      source: "etherscan",
      summary: `${mapping.symbol} token supply snapshot is available from Etherscan.`,
      metrics: [{ label: "token_supply_raw", value: supply }],
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...missing(mapping.symbol, error instanceof Error ? error.message : String(error)),
      status: "partial",
    };
  } finally {
    clearTimeout(timer);
  }
}
