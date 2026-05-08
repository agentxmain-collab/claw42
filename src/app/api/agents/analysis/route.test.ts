import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SignalCard } from "@/types/signal";

const getHotSignalsMock = vi.hoisted(() => vi.fn());
const getMajorEventMock = vi.hoisted(() => vi.fn());
const generateTextMock = vi.hoisted(() => vi.fn());
const getAgentAnalysisMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/signal-engine", () => ({
  getHotSignals: getHotSignalsMock,
  getMajorEvent: getMajorEventMock,
}));

vi.mock("@/lib/llm/generateText", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/agentAnalysis", () => ({
  getAgentAnalysis: getAgentAnalysisMock,
}));

import { GET } from "@/app/api/agents/analysis/route";

function buildSignal(symbol: string): SignalCard {
  return {
    id: `signal-${symbol}`,
    version: 1,
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    facts: {
      title: { zh: `${symbol} 信号`, en: `${symbol} signal` },
      summary: { zh: "成交量放大", en: "Volume expanded" },
      fullSummary: { zh: "成交量放大并接近关键位", en: "Volume expanded near a key level" },
      source: "test",
      publishedAt: "2026-05-08T00:00:00.000Z",
      eventType: "market_move",
      eventStatus: "developing",
    },
    explanation: {
      whyItMatters: { zh: "影响短线定价", en: "Impacts short-term pricing" },
      marketContext: { zh: "市场等待确认", en: "Market waits for confirmation" },
      watchPoints: [{ zh: "观察成交量", en: "Watch volume" }],
    },
    judgment: {
      direction: "bullish",
      confidence: 72,
      impactLevel: "high",
      riskNotes: [{ zh: "防假突破", en: "Avoid fake breakout" }],
    },
    impact: {
      primaryAsset: symbol,
      relatedAssets: [],
      tracks: ["btc_eth"],
      tradingPairs: [`${symbol}/USDT`],
      projects: [],
      campaignTags: [],
    },
    evidence: {
      pieces: [],
      timeline: [],
      multiSourceConfirm: false,
      confirmCount: 0,
    },
    actions: [],
    engine: {
      candidateScore: 80,
      isHeadliner: true,
      dedupKey: `market_move:${symbol}:2026-05-08`,
      rules: ["test"],
    },
  };
}

describe("/api/agents/analysis", () => {
  beforeEach(() => {
    getHotSignalsMock.mockReset();
    getMajorEventMock.mockReset();
    generateTextMock.mockReset();
    getAgentAnalysisMock.mockReset();
  });

  test("returns grounded single-agent analysis when symbol and agent are provided", async () => {
    getHotSignalsMock.mockResolvedValueOnce([buildSignal("BTC")]);
    getMajorEventMock.mockResolvedValueOnce({ event: null });
    generateTextMock.mockResolvedValueOnce("BTC 成交量放大，先等关键位确认。");

    const response = await GET(
      new NextRequest("https://claw42.ai/api/agents/analysis?symbol=BTC&agent=alpha"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      content: "BTC 成交量放大，先等关键位确认。",
      signalCardId: "signal-BTC",
      dataLayer: "all",
    });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.stringContaining("SignalCard"),
      expect.objectContaining({ taskTag: "analysis:alpha:BTC" }),
    );
  });

  test("keeps the legacy locale payload path when no symbol or agent is provided", async () => {
    getAgentAnalysisMock.mockResolvedValueOnce({ generatedAt: 1, stream: [] });

    const response = await GET(
      new NextRequest("https://claw42.ai/api/agents/analysis?locale=zh_CN"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ generatedAt: 1, stream: [] });
  });

  test("returns explicit waiting response when SignalEngine has no grounded signal", async () => {
    getHotSignalsMock.mockResolvedValueOnce([]);
    getMajorEventMock.mockResolvedValueOnce({ event: null });

    const response = await GET(
      new NextRequest("https://claw42.ai/api/agents/analysis?symbol=ETH&agent=gamma"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.signalCardId).toBeNull();
    expect(json.content).toContain("等数据");
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});
