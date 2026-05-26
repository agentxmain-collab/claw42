import { readFile } from "fs/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { runSimplePipeline } from "@/lib/team/simplePipeline";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";
import type { NewsItem } from "@/lib/types";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

const generateTextMock = vi.hoisted(() => vi.fn());
const appendDecisionRecordMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llm/generateText", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  appendDecisionRecord: appendDecisionRecordMock,
}));

const now = Date.UTC(2026, 4, 26, 8, 0, 0);

const marketCandidate: DecisionCandidate = {
  candidateType: "market_overview",
  candidateKey: "market_overview:zh_CN:2026-05-26",
  displayTitle: "今日大盘综述",
  executable: false,
  cadence: "daily",
  score: 100,
  reasons: [],
};

const hotspotCandidate: DecisionCandidate = {
  candidateType: "hotspot",
  candidateKey: "hotspot:zh_CN:2026-05-26",
  displayTitle: "热点叙事追踪",
  executable: false,
  cadence: "event",
  score: 96,
  reasons: [],
};

const btcCandidate: DecisionCandidate = {
  candidateType: "symbol",
  candidateKey: "news-driven:BTC:test",
  symbol: "BTC",
  displayTitle: "BTC 实时行情分析",
  executable: true,
  cadence: "event",
  score: 95,
  reasons: [],
};

const hypeCandidate: DecisionCandidate = {
  candidateType: "symbol",
  candidateKey: "news-driven:HYPE:test",
  symbol: "HYPE",
  displayTitle: "HYPE 实时行情分析",
  executable: true,
  cadence: "event",
  score: 82,
  reasons: [],
};

function news(symbol = "BTC"): NewsItem {
  return {
    id: `news-${symbol}`,
    title: `${symbol} futures volume expands`,
    url: `https://example.com/${symbol.toLowerCase()}`,
    source: "CoinDesk",
    currencies: [symbol],
    sentiment: "bullish",
    publishedAt: now,
  };
}

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 2.1 },
      ETH: { price: 3800, change24h: 0.4 },
      SOL: { price: 170, change24h: -0.8 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [
      {
        symbol: "BTC",
        price: 101000,
        change24h: 2.1,
        category: "majors",
        execution: { executable: true, coinwPair: "BTC_USDT", watchOnly: false },
      },
    ],
    trending: [
      {
        symbol: "HYPE",
        price: 34,
        change24h: 9.4,
        category: "trending",
        execution: { executable: true, coinwPair: "HYPE_USDT", watchOnly: false },
      },
    ],
    opportunity: [],
    source: "coinw-kline",
  };
}

function recordsWritten() {
  return appendDecisionRecordMock.mock.calls.map((call) => call[0] as StrategyDecisionRecord);
}

describe("runSimplePipeline", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    appendDecisionRecordMock.mockReset();
    appendDecisionRecordMock.mockResolvedValue(undefined);
  });

  it("calls generateText at most once per generated record", async () => {
    generateTextMock
      .mockResolvedValueOnce(
        JSON.stringify({
          analysisSummary: "大盘风险偏好改善，但仍以观察结论为主。",
          rationale: "大盘风险偏好改善。",
          direction: "neutral",
          confidence: 0.62,
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          analysisSummary: "BTC 成交与新闻共振，短线偏多。",
          rationale: "BTC 成交与新闻共振，短线偏多。",
          direction: "long",
          confidence: 0.76,
          entryPrice: 101000,
          stopLoss: 99000,
          takeProfit: [104000, 106000],
          positionSizing: 0.06,
          riskNote: "跌破 99000 降级。",
          invalidatesIf: "BTC 跌破 99000。",
        }),
      );

    const result = await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news()],
      residentCandidates: [marketCandidate],
      newsDrivenCandidates: [{ candidate: btcCandidate, newsItem: news(), symbol: "BTC" }],
    });

    expect(result.generatedRecords).toHaveLength(2);
    expect(generateTextMock).toHaveBeenCalledTimes(result.generatedRecords.length);
    expect(recordsWritten()).toHaveLength(2);
  });

  it("writes canonical observation records with six completed public stages", async () => {
    generateTextMock.mockResolvedValue(
      JSON.stringify({
        analysisSummary: "热点叙事转强，但不生成交易方案。",
        rationale: "热点叙事转强。",
        direction: "long",
        confidence: 0.68,
      }),
    );

    await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news("HYPE")],
      residentCandidates: [hotspotCandidate],
      newsDrivenCandidates: [],
    });

    const [record] = recordsWritten();
    expect(record).toMatchObject({
      schemaVersion: 2,
      recordSource: "live",
      symbol: "HOTSPOT",
      candidate: {
        candidateType: "hotspot",
        executable: false,
      },
      tradeDecision: null,
      decisionOwnerId: "pm",
      modelProvider: "simple-pipeline",
    });
    expect(record.stageTrace?.map((stage) => `${stage.stageId}:${stage.status}`)).toEqual([
      "analyst_inputs:done",
      "research_lead:done",
      "trade_decision:done",
      "risk_lead:done",
      "record_write:done",
      "public_timeline:done",
    ]);

    const event = projectDecisionRecordToPublicEvent(record);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload).toMatchObject({
      candidateType: "hotspot",
      executable: false,
      tradeDecision: null,
      analysisSummary: "热点叙事转强，但不生成交易方案。",
    });
    expect(event.payload.stageTrace?.map((stage) => stage.status)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
  });

  it("writes executable symbol records only when the LLM returns a complete trade plan", async () => {
    generateTextMock.mockResolvedValue(
      JSON.stringify({
        analysisSummary: "BTC 资金回流改善，交易方案完整。",
        rationale: "BTC 资金回流改善。",
        direction: "long",
        confidence: 0.78,
        entryPrice: 101000,
        stopLoss: 99000,
        takeProfit: [104000],
        positionSizing: 0.05,
        riskNote: "跌破 99000 降级。",
        invalidatesIf: "BTC 跌破 99000。",
      }),
    );

    await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news()],
      residentCandidates: [],
      newsDrivenCandidates: [{ candidate: btcCandidate, newsItem: news(), symbol: "BTC" }],
    });

    const [record] = recordsWritten();
    expect(record.symbol).toBe("BTC");
    expect(record.tradeDecision).toMatchObject({
      symbol: "BTC",
      direction: "long",
      entryPrice: 101000,
      stopLoss: 99000,
      takeProfit: [104000],
    });
    const event = projectDecisionRecordToPublicEvent(record);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload).toMatchObject({
      candidateType: "symbol",
      executable: true,
      tradeDecision: expect.objectContaining({ symbol: "BTC", direction: "long" }),
    });
  });

  it("keeps stale or no-signal symbol output as a no-strategy public record", async () => {
    generateTextMock.mockResolvedValue(
      JSON.stringify({
        analysisSummary: "HYPE 动量不足，暂不形成交易方案。",
        rationale: "HYPE 动量不足。",
        direction: "wait",
        confidence: 0.42,
      }),
    );

    await runSimplePipeline({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [news("HYPE")],
      residentCandidates: [],
      newsDrivenCandidates: [{ candidate: hypeCandidate, newsItem: news("HYPE"), symbol: "HYPE" }],
    });

    const [record] = recordsWritten();
    expect(record.symbol).toBe("HYPE");
    expect(record.tradeDecision).toBeNull();
    expect(record.analystInputs.find((input) => input.memberId === "pm")).toMatchObject({
      memberId: "pm",
      direction: "wait",
      confidence: 0.42,
    });
    const event = projectDecisionRecordToPublicEvent(record);
    if (event?.payload.kind !== "pm_decision") throw new Error("expected pm decision payload");
    expect(event.payload.tradeDecision).toBeNull();
    expect(event.payload.executable).toBe(true);
  });

  it("does not import the retired multi-step public-chatter path", async () => {
    const source = await readFile("src/lib/team/simplePipeline.ts", "utf8");
    expect(source).not.toMatch(/multiRoundPipeline|chatter|chatGuardrails|sedimentation/);
  });
});
