import { describe, expect, it } from "vitest";
import {
  buildStrategyResolutionDiagnostic,
  classifyDecisionRecord,
  STRATEGY_RESOLUTION_BUCKET_LABELS,
} from "@/lib/team/strategyResolutionDiag";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import type { TradeDecision } from "@/lib/team/tradeDecision";
import type { ProviderCallTelemetry } from "@/lib/team/providerTelemetry";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { PublicCardIndexPage } from "@/lib/watch/publicCardIndex";

const now = Date.UTC(2026, 4, 28, 12, 0, 0);

describe("classifyDecisionRecord", () => {
  it("covers all 10 mutually exclusive resolution buckets", () => {
    const priceBySymbol = new Map<string, number | null | undefined>([
      ["BTC", 112],
      ["ETH", 94],
      ["SOL", 101],
      ["DOGE", Number.NaN],
    ]);
    const cases: Array<[string, StrategyDecisionRecord, string]> = [
      [
        "alreadyResolved",
        record({
          id: "resolved",
          resolvedAt: new Date(now).toISOString(),
          resolvedOutcome: "hit_tp",
        }),
        "alreadyResolved",
      ],
      [
        "openNoTradeDecision",
        record({ id: "no-trade", tradeDecision: null }),
        "openNoTradeDecision",
      ],
      [
        "openStrategyNoEvaluationWindow",
        record({ id: "no-window", evaluationWindowEndsAt: null }),
        "openStrategyNoEvaluationWindow",
      ],
      [
        "openStrategyWindowNotElapsed",
        record({ id: "not-elapsed", evaluationWindowEndsAt: new Date(now + 60_000).toISOString() }),
        "openStrategyWindowNotElapsed",
      ],
      [
        "openStrategyWindowElapsedMissingPrice",
        record({
          id: "missing",
          symbol: "HYPE",
          evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
        }),
        "openStrategyWindowElapsedMissingPrice",
      ],
      [
        "openStrategyWindowElapsedInvalidPrice",
        record({
          id: "invalid",
          symbol: "DOGE",
          evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
        }),
        "openStrategyWindowElapsedInvalidPrice",
      ],
      [
        "openStrategyWindowElapsedResolvableHitTp",
        record({ id: "hit-tp", evaluationWindowEndsAt: new Date(now - 60_000).toISOString() }),
        "openStrategyWindowElapsedResolvableHitTp",
      ],
      [
        "openStrategyWindowElapsedResolvableHitSl",
        record({
          id: "hit-sl",
          symbol: "ETH",
          evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
        }),
        "openStrategyWindowElapsedResolvableHitSl",
      ],
      [
        "openStrategyWindowElapsedResolvableExpired",
        record({
          id: "expired",
          symbol: "SOL",
          evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
        }),
        "openStrategyWindowElapsedResolvableExpired",
      ],
      [
        "openStrategyManualCloseExcluded",
        record({ id: "manual", resolvedOutcome: "manual_close" }),
        "openStrategyManualCloseExcluded",
      ],
    ];

    expect(cases.map(([label]) => label).sort()).toEqual(
      [...STRATEGY_RESOLUTION_BUCKET_LABELS].sort(),
    );
    for (const [, input, expected] of cases) {
      expect(classifyDecisionRecord(input, now, priceBySymbol)).toBe(expected);
    }
  });
});

describe("buildStrategyResolutionDiagnostic", () => {
  it("summarizes baseline and CoinW-augmented dry runs without network price fetches", async () => {
    const records = [
      record({
        id: "hit-tp",
        symbol: "BTC",
        evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
      }),
      record({
        id: "missing-hype",
        symbol: "HYPE",
        evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
      }),
      record({
        id: "missing-unknown",
        symbol: "NOPE",
        evaluationWindowEndsAt: new Date(now - 60_000).toISOString(),
      }),
    ];
    const result = await buildStrategyResolutionDiagnostic({
      locale: "zh_CN",
      readLimit: 500,
      now,
      getPool: async () => pool(),
      readRecords: async () => records,
      readIndexPage: async () => publicIndexPage(["pm-decision:hit-tp"]),
      readIndexFailures: async () => [
        {
          recordId: "missing-hype",
          locale: "zh_CN",
          symbol: "HYPE",
          recordCreatedAt: new Date(now - 10 * 60_000).toISOString(),
          failedAt: new Date(now).toISOString(),
          stage: "public-card-index",
          error: "zadd down",
        },
      ],
      readJobs: async () => [
        {
          id: "job-1",
          schemaVersion: 1,
          kind: "once",
          status: "failed",
          triggerSource: "cron",
          locale: "zh_CN",
          idempotencyKey: "job-1",
          candidate: null,
          symbol: "BTC",
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
          startedAt: null,
          completedAt: null,
          attemptCount: 1,
          maxAttempts: 3,
          nextRunAt: null,
          lastError: "provider empty",
          outputCount: 0,
          decisionRecordIds: [],
          auditEventCount: 0,
        },
      ],
      readRuns: async () => [
        {
          id: "run-1",
          schemaVersion: 1,
          status: "failed",
          triggerSource: "cron",
          locale: "zh_CN",
          candidate: {
            candidateType: "symbol",
            candidateKey: "news-driven:BTC:test",
            displayTitle: "BTC",
            executable: true,
            symbol: "BTC",
          },
          symbol: "BTC",
          startedAt: new Date(now - 2 * 60_000).toISOString(),
          completedAt: new Date(now - 60_000).toISOString(),
          stageStatus: { analyst_inputs: "failed" },
          analystRoundCount: 0,
          activeMemberIds: [],
          abstainedMemberIds: [],
          decisionRecordId: null,
          publicTimelineEventId: null,
          error: "deepseek-chat empty response",
          skipReason: null,
        },
      ],
      readProviderCalls: async () => [
        providerCall({
          taskTag: "watch:simple-pipeline:symbol:zh_CN",
          success: false,
          error: "deepseek-chat deepseek-v4-pro empty response",
        }),
        providerCall({
          taskTag: "watch:simple-pipeline:symbol:zh_CN",
          finalProvider: "deepseek-chat",
          success: true,
        }),
      ],
      getNewsHealth: () => [
        {
          id: "cryptocompare",
          displayName: "CryptoCompare",
          role: "primary",
          status: "active",
          authRequired: true,
          authConfigured: true,
          inFetchChain: true,
          fetchChainRank: 0,
          availableByConfig: true,
          unavailableReason: null,
        },
        {
          id: "cryptopanic",
          displayName: "CryptoPanic",
          role: "standby",
          status: "standby",
          authRequired: true,
          authConfigured: false,
          inFetchChain: false,
          fetchChainRank: null,
          availableByConfig: false,
          unavailableReason: "missing_env",
        },
      ],
      getInstrumentSet: async () =>
        new Map([
          ["BTC", {}],
          ["HYPE", {}],
        ]),
      checkRuntimeLock: async (key) => ({ key, locked: false, expiresAt: null }),
    });

    expect(result.poolEntryCounts).toEqual({ majors: 1, trending: 0, opportunity: 0 });
    expect(result.buckets.openStrategyWindowElapsedResolvableHitTp).toBe(1);
    expect(result.buckets.openStrategyWindowElapsedMissingPrice).toBe(2);
    expect(result.dryRun.baselinePoolOnly).toMatchObject({
      resolvableCount: 1,
      hitTp: 1,
      stillMissingPrice: 2,
    });
    expect(result.dryRun.coinwResolverAugmented).toMatchObject({
      resolvableCount: 2,
      stillMissingPrice: 1,
      perSourceBreakdown: { pool: 1, coinwWhitelistedAssumed: 1 },
    });
    expect(result.dryRun.coinwResolverAugmented.topMissingSymbols).toEqual([
      { symbol: "NOPE", count: 1 },
    ]);
    expect(result.rawStrategyButNotIndexedCount).toBe(2);
    expect(result.indexWriteFailureSample).toEqual(["missing-hype"]);
    expect(result.recentJobErrors).toEqual([
      {
        id: "job-1",
        status: "failed",
        updatedAt: new Date(now).toISOString(),
        lastError: "provider empty",
      },
    ]);
    expect(result.cronHealthTrace.providerHealthLast24h).toMatchObject({
      totalCalls: 2,
      simplePipelineCalls: 2,
      successCalls: 1,
      failureCalls: 1,
      providerCounts: { "deepseek-chat": 1 },
      attemptedProviderCounts: { "deepseek-chat": 2 },
    });
    expect(result.cronHealthTrace.klinePipelineHealth).toMatchObject({
      poolSource: "coinw-kline",
      recordsMissingPrice: 2,
      topMissingPriceSymbols: [
        { symbol: "HYPE", count: 1 },
        { symbol: "NOPE", count: 1 },
      ],
    });
    expect(result.cronHealthTrace.newsInputHealth).toMatchObject({
      configuredSources: 2,
      availableSources: 1,
      activeFetchChainSources: ["cryptocompare"],
      missingEnvSources: ["cryptopanic"],
    });
    expect(result.cronHealthTrace.stagesWriteRatio).toMatchObject({
      rawRecordCount: 3,
      rawStrategyRecordCount: 3,
      publicIndexEntryCount: 1,
      rawStrategyToRawRatio: 1,
      publicIndexToRawStrategyRatio: 0.3333,
    });
    expect(result.cronHealthTrace.lastCronInvocations[0]).toMatchObject({
      source: "pm_job",
      id: "job-1",
      status: "failed",
    });
  });
});

function pool(): CoinPoolPayload {
  return {
    ts: now - 5_000,
    tickers: {
      BTC: { price: 112, change24h: 1 },
      ETH: { price: 94, change24h: -1 },
      SOL: { price: 101, change24h: 0 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [{ symbol: "BTC", price: 112, change24h: 1, category: "majors" }],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

function publicIndexPage(ids: string[]): PublicCardIndexPage {
  return {
    entries: ids.map((id) => ({
      id,
      symbol: "BTC",
      decisionDir: "long" as const,
      newsHeadline: null,
      createdAt: new Date(now).toISOString(),
      recordKey: `record:${id}`,
      evidenceId: null,
    })),
    page: 1,
    pageSize: 100,
    totalCount: ids.length,
    hasMore: false,
    oldestAt: ids.length > 0 ? new Date(now).toISOString() : null,
  };
}

function providerCall(overrides: Partial<ProviderCallTelemetry>): ProviderCallTelemetry {
  return {
    ts: now - 60_000,
    taskTag: "watch:simple-pipeline:symbol:zh_CN",
    roleId: null,
    defaultProvider: null,
    providerOverride: "deepseek-chat",
    providerChain: ["deepseek-chat", "minimax"],
    attemptedProviders: ["deepseek-chat"],
    skippedProviders: [],
    finalProvider: null,
    fallbackCount: 0,
    latencyMs: 1200,
    success: true,
    cached: false,
    cacheHitProvider: null,
    error: null,
    ...overrides,
  };
}

function record(
  overrides: {
    id?: string;
    symbol?: string;
    evaluationWindowEndsAt?: string | null;
    tradeDecision?: TradeDecision | null;
    resolvedAt?: string | null;
    resolvedOutcome?: StrategyDecisionRecord["resolvedOutcome"];
  } = {},
): StrategyDecisionRecord {
  const symbol = overrides.symbol ?? "BTC";
  const direction = symbol === "ETH" ? "long" : "long";
  const tradeDecision: TradeDecision | null =
    overrides.tradeDecision === null
      ? null
      : {
          id: `trade-${overrides.id ?? "record"}`,
          schemaVersion: 1,
          symbol,
          generatedBy: "pm",
          generatedAt: new Date(now - 10 * 60_000).toISOString(),
          direction,
          entryType: "market",
          entryPrice: 100,
          entryRange: null,
          stopLoss: 95,
          takeProfit: [110, 115],
          positionSizing: 0.05,
          timeHorizon: "intraday",
          rating: 4,
          confidence: 0.75,
          evidenceIds: [],
          riskNote: "test risk",
          invalidatesIf: "test invalidation",
          promptVersion: "test",
          modelProvider: "stub",
          severity: "high",
        };

  return {
    id: overrides.id ?? "record-1",
    schemaVersion: 1,
    recordSource: "paper",
    symbol,
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["pm"],
    analystInputs: [],
    sourceThreadId: null,
    tradeDecision,
    createdAt: new Date(now - 10 * 60_000).toISOString(),
    evaluationWindowEndsAt:
      "evaluationWindowEndsAt" in overrides
        ? (overrides.evaluationWindowEndsAt ?? null)
        : new Date(now + 60_000).toISOString(),
    resolvedAt: overrides.resolvedAt ?? null,
    resolvedOutcome: overrides.resolvedOutcome ?? null,
    promptVersion: "test",
    modelProvider: "stub",
  };
}
