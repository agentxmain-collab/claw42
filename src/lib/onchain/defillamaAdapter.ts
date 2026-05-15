import type { AnalystDataStatus } from "@/lib/team/strategyDecisionRecord";
import { resolveSymbolMapping } from "@/lib/team/symbolMapping";

export interface DefiLlamaProtocolSnapshot {
  status: AnalystDataStatus;
  source: "defillama";
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  reason?: string;
  fetchedAt: string;
}

function snapshot(
  symbol: string,
  status: AnalystDataStatus,
  summary: string,
  metrics: Array<{ label: string; value: string }> = [],
  reason?: string,
): DefiLlamaProtocolSnapshot {
  return {
    status,
    source: "defillama",
    summary: `${symbol} ${summary}`,
    metrics,
    reason,
    fetchedAt: new Date().toISOString(),
  };
}

function numberMetric(value: unknown): string | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
}

export async function fetchDefiLlamaProtocolEvidence(
  symbol: string,
): Promise<DefiLlamaProtocolSnapshot> {
  const mapping = resolveSymbolMapping(symbol);
  if (!mapping.defillamaSlug) {
    return snapshot(
      mapping.symbol,
      "missing",
      "DefiLlama protocol mapping is not configured.",
      [],
      "missing_slug",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://api.llama.fi/protocol/${encodeURIComponent(mapping.defillamaSlug)}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`defillama ${response.status}`);
    const payload = (await response.json()) as {
      tvl?: unknown;
      mcap?: unknown;
      name?: string;
      category?: string;
    };
    const metrics = [
      numberMetric(payload.tvl)
        ? { label: "tvl_usd", value: numberMetric(payload.tvl) ?? "" }
        : null,
      numberMetric(payload.mcap)
        ? { label: "market_cap_usd", value: numberMetric(payload.mcap) ?? "" }
        : null,
      payload.category ? { label: "category", value: payload.category } : null,
    ].filter((item): item is { label: string; value: string } => Boolean(item));

    if (metrics.length === 0) {
      return snapshot(
        mapping.symbol,
        "partial",
        "DefiLlama returned no usable protocol metrics.",
        [],
        "empty_metrics",
      );
    }

    return snapshot(
      mapping.symbol,
      "ok",
      `DefiLlama protocol metrics available${payload.name ? ` for ${payload.name}` : ""}.`,
      metrics,
    );
  } catch (error) {
    return snapshot(
      mapping.symbol,
      "partial",
      "DefiLlama protocol request failed.",
      [],
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}
