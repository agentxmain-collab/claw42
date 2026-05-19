import { describe, expect, it } from "vitest";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";
import { residentPrewarmCandidates, residentPrewarmPlan } from "@/lib/watch/residentPrewarm";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

const now = Date.parse("2026-05-13T19:20:00.000Z");

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: {
        price: 101000,
        change24h: 12,
      },
      ETH: { price: 4200, change24h: 0.4 },
      SOL: { price: 220, change24h: 0.3 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [
      {
        symbol: "BTC",
        price: 101000,
        change24h: 12,
        category: "majors",
        marketCapUsd: 2_000_000_000_000,
        totalVolumeUsd24h: 60_000_000_000,
      },
    ],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

function highImpactNews(): NewsItem {
  return {
    id: "news-btc",
    title: "BTC ETF inflows accelerate as volatility breaks higher",
    url: "https://example.com/btc-etf",
    source: "CoinDesk",
    currencies: ["BTC"],
    sentiment: "bullish",
    publishedAt: now - 5 * 60_000,
    votes: {
      positive: 9,
      negative: 0,
      important: 8,
    },
  };
}

describe("residentPrewarmCandidates", () => {
  it("can emit a burst hotspot outside the fixed 3-hour baseline window", () => {
    const candidates = residentPrewarmCandidates({
      locale: "zh_CN",
      now,
      pool: pool(),
      newsItems: [highImpactNews()],
    });

    expect(candidates.map((candidate) => candidate.candidateKey)).toEqual([
      "hotspot:burst:zh_CN:2026-05-13T19:BTC",
    ]);
    expect(candidates[0]).toMatchObject({
      candidateType: "hotspot",
      symbol: "BTC",
      executable: false,
    });
  });

  it("adds due failed resident retries outside the fixed UTC cadence window", () => {
    const retryNow = Date.parse("2026-05-13T20:10:00.000Z");
    const plan = residentPrewarmPlan({
      locale: "zh_CN",
      now: retryNow,
      pool: {
        ...pool(),
        ts: retryNow,
        majors: [],
      },
      newsItems: [],
      records: [],
      jobs: [
        residentJob({
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-13T18:market",
          status: "failed",
          updatedAt: "2026-05-13T18:05:00.000Z",
          completedAt: "2026-05-13T18:05:00.000Z",
          nextRunAt: "2026-05-13T20:00:00.000Z",
          lastError: "provider timeout",
        }),
      ],
    });

    expect(plan.fixedCadenceCandidateKeys).toEqual([]);
    expect(plan.backfillCandidateKeys).toEqual(["hotspot:utc:zh_CN:2026-05-13T18:market"]);
    expect(plan.candidates.map((candidate) => candidate.candidateKey)).toEqual([
      "hotspot:utc:zh_CN:2026-05-13T18:market",
    ]);
    expect(plan.residentStatus.hotspot).toMatchObject({
      state: "failed",
      slaState: "critical",
      nextRunAt: "2026-05-13T20:00:00.000Z",
    });
  });
});

function residentJob({
  candidateType,
  candidateKey,
  status,
  updatedAt,
  completedAt = null,
  nextRunAt = null,
  lastError = null,
}: {
  candidateType: "market_overview" | "hotspot";
  candidateKey: string;
  status: PmDecisionJobRecord["status"];
  updatedAt: string;
  completedAt?: string | null;
  nextRunAt?: string | null;
  lastError?: string | null;
}): PmDecisionJobRecord {
  return {
    id: `pm-job:${candidateKey}`,
    schemaVersion: 1,
    kind: "once",
    status,
    triggerSource: "cron",
    locale: "zh_CN",
    idempotencyKey: `once:cron:zh_CN:${candidateKey}`,
    candidate: {
      candidateType,
      candidateKey,
      displayTitle: candidateType === "market_overview" ? "今日大盘综述" : "热点叙事追踪",
      executable: false,
      cadence: candidateType === "market_overview" ? "daily" : "intraday",
      score: 100,
      reasons: [],
    },
    symbol: null,
    createdAt: updatedAt,
    updatedAt,
    startedAt: null,
    completedAt,
    attemptCount: status === "failed" ? 1 : 0,
    maxAttempts: 3,
    nextRunAt,
    lastError,
    outputCount: 0,
    decisionRecordIds: [],
    auditEventCount: 0,
  };
}
