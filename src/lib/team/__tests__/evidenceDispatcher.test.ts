import { describe, expect, it } from "vitest";
import {
  buildEvidenceContextPack,
  dataStatusForMember,
  evidenceIdsForMember,
  formatRoleEvidenceContext,
} from "@/lib/team/evidenceDispatcher";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { SignalRecord } from "@/modules/agent-watch/types";

const now = Date.UTC(2026, 4, 15, 12, 0, 0);

function signal(symbol = "BTC"): SignalRecord {
  return {
    id: `sig-${symbol}`,
    ts: now,
    symbol,
    type: "breakout",
    severity: "alert",
    payload: {
      priceLevel: 68000,
      change24h: 3.2,
      description: `${symbol} momentum accelerated`,
    },
  };
}

function evidence(symbol = "BTC"): NewsEvidence {
  return {
    id: `ev-${symbol}`,
    source: "CryptoCompare",
    title: `${symbol} ETF inflows rise`,
    url: `https://example.com/${symbol.toLowerCase()}`,
    publishedAt: new Date(now - 60_000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    symbol: [symbol],
    impactSeverity: "high",
    summary: `${symbol} ETF inflows rise`,
  };
}

describe("evidenceDispatcher", () => {
  it("separates chart and news evidence by role", async () => {
    const pack = await buildEvidenceContextPack({
      symbol: "BTC",
      recentMarketSignals: [signal("BTC"), signal("ETH")],
      recentNewsEvidence: [evidence("BTC"), evidence("ETH")],
    });

    expect(pack.chart.status).toBe("ok");
    expect(pack.news.status).toBe("ok");
    expect(pack.onchain.status).toBe("missing");
    expect(evidenceIdsForMember("chart_analyst", pack)).toContain("chart:BTC:signal:0");
    expect(evidenceIdsForMember("chart_analyst", pack)).not.toContain("ev-BTC");
    expect(evidenceIdsForMember("news_analyst", pack)).toContain("ev-BTC");
    expect(formatRoleEvidenceContext("chart_analyst", pack)).toContain(
      "You are the technical analyst",
    );
    expect(formatRoleEvidenceContext("chart_analyst", pack)).not.toContain("ETF inflows rise");
  });

  it("marks composite reviewers partial when some domains are missing", async () => {
    const pack = await buildEvidenceContextPack({
      symbol: "FIRO",
      recentMarketSignals: [signal("FIRO")],
      recentNewsEvidence: [],
    });

    expect(dataStatusForMember("neutral_reviewer", pack)).toBe("partial");
    expect(dataStatusForMember("news_analyst", pack)).toBe("missing");
  });
});
