import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, maxDuration } from "@/app/api/cron/strategy-replay/route";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

const normalizeNewsItemMock = vi.hoisted(() => vi.fn());
const fetchNewsWithChainMock = vi.hoisted(() => vi.fn());
const tryOrchestrateNewsDebateMock = vi.hoisted(() => vi.fn());
const listNewsDebatesMock = vi.hoisted(() => vi.fn());
const getCoinPoolMock = vi.hoisted(() => vi.fn());
const adjustDebtFromReplaysMock = vi.hoisted(() => vi.fn());
const tryAcquireLockMock = vi.hoisted(() => vi.fn());
const enqueuePmDecisionJobMock = vi.hoisted(() => vi.fn());
const readPmDecisionJobsMock = vi.hoisted(() => vi.fn());
const readDecisionRunsMock = vi.hoisted(() => vi.fn());
const publishPmDecisionJobToQueueMock = vi.hoisted(() => vi.fn());
const runPmDecisionJobMock = vi.hoisted(() => vi.fn());
const readAllDecisionRecordsMock = vi.hoisted(() => vi.fn());
const getDecisionRecordStoreDiagnosticsMock = vi.hoisted(() => vi.fn());
const getLastDecisionRecordWriteDiagnosticsMock = vi.hoisted(() => vi.fn());
const resolveDecisionRecordFromPriceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/news/normalizer", () => ({
  normalizeNewsItem: normalizeNewsItemMock,
}));

vi.mock("@/lib/news/sourceChain", () => ({
  fetchNewsWithChain: fetchNewsWithChainMock,
}));

vi.mock("@/lib/debateOrchestrator", () => ({
  tryOrchestrateNewsDebate: tryOrchestrateNewsDebateMock,
  listNewsDebates: listNewsDebatesMock,
}));

vi.mock("@/lib/marketDataCache", () => ({
  getCoinPool: getCoinPoolMock,
}));

vi.mock("@/lib/agentRelationship", () => ({
  adjustDebtFromReplays: adjustDebtFromReplaysMock,
}));

vi.mock("@/lib/strategyHistory", () => ({
  evaluateStrategy: vi.fn(),
  recordStrategyReplay: vi.fn(),
}));

vi.mock("@/lib/storage/kv-lock", () => ({
  tryAcquireLock: tryAcquireLockMock,
}));

vi.mock("@/lib/watch/pmDecisionJobLedger", () => ({
  enqueuePmDecisionJob: enqueuePmDecisionJobMock,
  readPmDecisionJobs: readPmDecisionJobsMock,
}));

vi.mock("@/lib/team/decisionRunLedger", () => ({
  readDecisionRuns: readDecisionRunsMock,
}));

vi.mock("@/lib/team/pmDecisionJobQueue", () => ({
  publishPmDecisionJobToQueue: publishPmDecisionJobToQueueMock,
}));

vi.mock("@/lib/team/pmDecisionJobRunner", () => ({
  runPmDecisionJob: runPmDecisionJobMock,
}));

vi.mock("@/lib/team/decisionRecordStore", () => ({
  getDecisionRecordStoreDiagnostics: getDecisionRecordStoreDiagnosticsMock,
  getLastDecisionRecordWriteDiagnostics: getLastDecisionRecordWriteDiagnosticsMock,
  readAllDecisionRecords: readAllDecisionRecordsMock,
}));

vi.mock("@/lib/team/decisionResolution", () => ({
  resolveDecisionRecordFromPrice: resolveDecisionRecordFromPriceMock,
}));

vi.mock("@/lib/watch/locale", () => ({
  localeFromRequestUrl: () => "zh_CN",
}));

const now = Date.UTC(2026, 4, 13, 20, 0, 0);

function newsItem(): NewsItem {
  return {
    id: "news-1",
    title: "BTC inflows rise",
    url: "https://example.com/btc",
    source: "CoinDesk",
    currencies: ["BTC"],
    sentiment: "bullish",
    publishedAt: now,
  };
}

function pool(): CoinPoolPayload {
  return {
    ts: now,
    tickers: {
      BTC: { price: 101000, change24h: 3.3 },
      ETH: { price: 4200, change24h: 0.5 },
      SOL: { price: 220, change24h: 0.2 },
      USDT: { price: 1, change24h: 0 },
    },
    majors: [{ symbol: "BTC", price: 101000, change24h: 3.3, category: "majors" }],
    trending: [],
    opportunity: [],
    source: "coinw-kline",
  };
}

function displayablePmTimelineEntry(
  overrides: Partial<PublicTimelineEvent> = {},
): PublicTimelineEvent {
  const ts = now;
  return {
    id: "pm-decision:pm:BTC:test",
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: ["ev_1"],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: "pm:BTC:test",
      symbol: "BTC",
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      tradeDecision: null,
      rounds: [
        {
          round: 1,
          memberId: "news_analyst",
          rationale: "BTC information collection has public evidence and momentum context",
        },
      ],
    },
    ...overrides,
  };
}

function hiddenPmTimelineEntry(): PublicTimelineEvent {
  return displayablePmTimelineEntry({
    payload: {
      kind: "pm_decision",
      recordId: "pm:BTC:hidden",
      symbol: "BTC",
      candidateType: "symbol",
      candidateKey: "BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      tradeDecision: null,
      rounds: [
        {
          round: 2,
          memberId: "bullish_researcher",
          rationale: "BTC peer debate remains constructive",
        },
      ],
    },
  });
}

describe("/api/cron/strategy-replay", () => {
  it("declares enough runtime for inline PM generation when queue mode is disabled", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(300);
  });

  beforeEach(() => {
    vi.setSystemTime(now);
    normalizeNewsItemMock.mockReset();
    fetchNewsWithChainMock.mockReset();
    tryOrchestrateNewsDebateMock.mockReset();
    listNewsDebatesMock.mockReset();
    getCoinPoolMock.mockReset();
    adjustDebtFromReplaysMock.mockReset();
    tryAcquireLockMock.mockReset();
    enqueuePmDecisionJobMock.mockReset();
    readPmDecisionJobsMock.mockReset();
    readDecisionRunsMock.mockReset();
    publishPmDecisionJobToQueueMock.mockReset();
    runPmDecisionJobMock.mockReset();
    readAllDecisionRecordsMock.mockReset();
    getDecisionRecordStoreDiagnosticsMock.mockReset();
    getLastDecisionRecordWriteDiagnosticsMock.mockReset();
    resolveDecisionRecordFromPriceMock.mockReset();

    fetchNewsWithChainMock.mockResolvedValue({
      items: [newsItem()],
      servedBy: "rss-coindesk",
      fellBackFrom: [],
    });
    normalizeNewsItemMock.mockImplementation(async (item) => item);
    tryOrchestrateNewsDebateMock.mockResolvedValue(null);
    listNewsDebatesMock.mockReturnValue([]);
    getCoinPoolMock.mockResolvedValue(pool());
    adjustDebtFromReplaysMock.mockResolvedValue(undefined);
    tryAcquireLockMock.mockResolvedValue({
      key: "cron:strategy-replay:trigger-now",
      token: "lock",
      acquiredAt: now,
    });
    enqueuePmDecisionJobMock.mockImplementation(async (input) => ({
      id: "pm-job:test",
      schemaVersion: 1,
      kind: input.kind,
      status: "queued",
      triggerSource: input.triggerSource,
      locale: input.locale,
      idempotencyKey: "test",
      candidate: input.candidate ?? null,
      symbol: input.symbol ?? null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      startedAt: null,
      completedAt: null,
      attemptCount: 0,
      maxAttempts: 3,
      nextRunAt: new Date(now).toISOString(),
      lastError: null,
      outputCount: 0,
      decisionRecordIds: [],
      auditEventCount: 0,
    }));
    readPmDecisionJobsMock.mockResolvedValue([]);
    readDecisionRunsMock.mockResolvedValue([
      {
        id: "run:pm:BTC:test",
        status: "succeeded",
        triggerSource: "cron",
        locale: "zh_CN",
        candidate: { candidateType: "symbol", candidateKey: "BTC", displayTitle: "BTC" },
        symbol: "BTC",
        startedAt: "2026-05-13T20:00:00.000Z",
        completedAt: "2026-05-13T20:01:00.000Z",
        stageStatus: { information_collection: "succeeded" },
        analystRoundCount: 1,
        skipReason: null,
        error: null,
        decisionRecordId: "pm:BTC:test",
        publicTimelineEventId: "pm-decision:pm:BTC:test",
        quality: {
          schemaVersion: 1,
          score: 90,
          publishable: true,
          warnings: [],
          blockingWarnings: [],
        },
      },
    ]);
    getDecisionRecordStoreDiagnosticsMock.mockResolvedValue({
      storageMode: "persistent",
      configuredStorageMode: "persistent",
      useKvEnvActualValue: '"true"',
      kvConfigured: true,
      kvKeyPrefix: "claw42:strategy:records:v1:",
      kvSymbolIndexKey: "claw42:strategy:records:v1:zh_CN:symbols",
      legacyKvSymbolIndexKey: "decision-record:v1:symbols",
      deploymentId: "dpl_test",
      gitSha: "sha_test",
      lastWrite: null,
      decisionRecordReadResult: {
        locale: "zh_CN",
        symbolsChecked: ["BTC"],
        recordCount: 1,
        firstRecordCreatedAt: "2026-05-13T20:00:00.000Z",
        requestedRecordIdsPresent: ["pm:BTC:test"],
      },
    });
    getLastDecisionRecordWriteDiagnosticsMock.mockReturnValue({
      operation: "append",
      storageMode: "persistent",
      configuredStorageMode: "persistent",
      locale: "zh_CN",
      symbol: "BTC",
      recordId: "pm:BTC:test",
      kvKeyPrefix: "claw42:strategy:records:v1:",
      kvSymbolKey: "claw42:strategy:records:v1:zh_CN:BTC",
      kvSymbolIndexKey: "claw42:strategy:records:v1:zh_CN:symbols",
      lpushResult: 1,
      ltrimResult: "OK",
      saddResult: 1,
    });
    publishPmDecisionJobToQueueMock.mockResolvedValue({ mode: "disabled" });
    runPmDecisionJobMock.mockImplementation(async (job, context) => {
      context.onAudit?.({
        type: "candidate_considered",
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
        symbol: "BTC",
        score: 40,
        reasonCount: 2,
        hasTrigger: true,
        marketSignalIds: ["ticker:BTC"],
        newsEvidenceIds: ["ev_1"],
      });
      return {
        job: { ...job, status: "succeeded" },
        outputs: [
          {
            record: { id: "pm:BTC:test" },
            publicTimelineEntry: displayablePmTimelineEntry(),
            tradeDecision: {},
          },
        ],
        auditEvents: [],
      };
    });
    readAllDecisionRecordsMock.mockResolvedValue([
      {
        id: "pm:BTC:open",
        symbol: "BTC",
        tradeDecision: { id: "trade:BTC:open" },
        resolvedOutcome: null,
      },
      residentDecisionRecord("market_overview", "2026-05-13T18:30:00.000Z"),
      residentDecisionRecord("hotspot", "2026-05-13T18:45:00.000Z"),
    ]);
    resolveDecisionRecordFromPriceMock.mockResolvedValue({
      record: { id: "pm:BTC:open", resolvedOutcome: "hit_tp" },
      resolution: { outcome: "hit_tp" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthorized cron requests before running source or PM side effects", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "unauthorized" });
    expect(fetchNewsWithChainMock).not.toHaveBeenCalled();
    expect(getCoinPoolMock).not.toHaveBeenCalled();
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalled();
    expect(runPmDecisionJobMock).not.toHaveBeenCalled();
  });

  it("returns PM decision audit details for trigger=now verification", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.pmDecisionGenerated).toBe(true);
    expect(payload.pmDecisionAudit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "candidate_considered",
          symbol: "BTC",
          hasTrigger: true,
        }),
      ]),
    );
    expect(payload.newsSourceHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "coinw-announcements",
          unavailableReason: "planned_endpoint",
        }),
      ]),
    );
    expect(payload.decisionRecordDiagnostics).toMatchObject({
      storageMode: "persistent",
      useKvEnvActualValue: '"true"',
      kvKeyPrefix: "claw42:strategy:records:v1:",
      decisionRecordWriteResult: expect.objectContaining({
        storageMode: "persistent",
        recordId: "pm:BTC:test",
      }),
      decisionRecordReadResult: expect.objectContaining({
        recordCount: 1,
        requestedRecordIdsPresent: ["pm:BTC:test"],
      }),
    });
    expect(payload.decisionRunDiagnostics).toEqual([
      expect.objectContaining({
        status: "succeeded",
        candidateType: "symbol",
        decisionRecordId: "pm:BTC:test",
        publicTimelineEventId: "pm-decision:pm:BTC:test",
        error: null,
        stageStatus: { information_collection: "succeeded" },
        analystRoundCount: 1,
        quality: expect.objectContaining({ publishable: true }),
      }),
    ]);
    expect(getDecisionRecordStoreDiagnosticsMock).toHaveBeenCalledWith({
      locale: "zh_CN",
      symbols: ["BTC"],
      recordIds: ["pm:BTC:test"],
      limit: 20,
    });
    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:open" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
    expect(tryAcquireLockMock).toHaveBeenCalledWith("cron:strategy-replay:trigger-now:zh_CN", {
      ttlMs: 5 * 60_000,
      waitMs: 0,
    });
  });

  it("redacts failed PM run errors in trigger=now diagnostics", async () => {
    readDecisionRunsMock.mockResolvedValueOnce([
      {
        id: "run:pm:HOTSPOT:test",
        status: "failed",
        triggerSource: "cron",
        locale: "zh_CN",
        candidate: {
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:test",
          displayTitle: "热点叙事追踪",
        },
        symbol: "HOTSPOT",
        startedAt: "2026-05-13T20:00:00.000Z",
        completedAt: "2026-05-13T20:01:00.000Z",
        stageStatus: { information_collection: "failed" },
        analystRoundCount: 0,
        skipReason: null,
        error: "provider failed with Bearer secret-token and api_key=secret-value",
        decisionRecordId: null,
        publicTimelineEventId: null,
        quality: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.decisionRunDiagnostics).toEqual([
      expect.objectContaining({
        status: "failed",
        candidateType: "hotspot",
        error: "provider failed with Bearer [redacted] and api_key=[redacted]",
        stageStatus: { information_collection: "failed" },
        analystRoundCount: 0,
      }),
    ]);
  });

  it("does not let failed news debate orchestration block the PM update loop", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      tryOrchestrateNewsDebateMock.mockRejectedValueOnce(
        new SyntaxError("Unterminated string in JSON"),
      );

      const response = await GET(
        new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.pmDecisionGenerated).toBe(true);
      expect(payload.generatedDebates).toBe(0);
      expect(runPmDecisionJobMock).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "[claw42] news debate orchestration skipped",
        expect.objectContaining({
          newsId: "news-1",
          error: "Unterminated string in JSON",
        }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("keeps audit and source-health details out of the scheduled cron response", async () => {
    runPmDecisionJobMock.mockResolvedValueOnce({
      job: { id: "pm-job:test", status: "succeeded" },
      outputs: [
        {
          record: { id: "pm:BTC:cron" },
          publicTimelineEntry: displayablePmTimelineEntry(),
          tradeDecision: {},
        },
      ],
      auditEvents: [],
    });

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(payload.pmDecisionGenerated).toBe(true);
    expect(payload.generatedPmDecisions).toBe(1);
    expect(payload.pmDecisionAudit).toBeUndefined();
    expect(payload.newsSourceHealth).toBeUndefined();
    expect(payload.trigger).toBeNull();
    expect(payload.triggerLockAcquiredAt).toBeNull();
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "batch",
        triggerSource: "cron",
        locale: "zh_CN",
      }),
    );
    expect(runPmDecisionJobMock).toHaveBeenCalledTimes(1);
  });

  it("does not report a generated PM decision when the output is not publicly displayable", async () => {
    runPmDecisionJobMock.mockResolvedValueOnce({
      job: { id: "pm-job:test", status: "succeeded" },
      outputs: [
        {
          record: { id: "pm:BTC:hidden" },
          publicTimelineEntry: hiddenPmTimelineEntry(),
          tradeDecision: {},
        },
      ],
      auditEvents: [],
    });

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.pmDecisionGenerated).toBe(false);
    expect(payload.generatedPmDecisions).toBe(0);
    expect(payload.generatedHiddenPmDecisions).toBe(1);
  });

  it("caps inline resident prewarm work when queue mode is unavailable", async () => {
    const prewarmNow = Date.parse("2026-05-13T18:00:00.000Z");
    vi.setSystemTime(prewarmNow);

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarmGenerated).toBe(1);
    expect(payload.residentPrewarmCandidates).toEqual([
      "market_overview:utc:zh_CN:2026-05-13T18",
      "hotspot:utc:zh_CN:2026-05-13T18:market",
    ]);
    expect(payload.pmDecisionInlineLimit).toEqual({
      limit: 1,
      used: 1,
      deferredResidentCandidateKeys: ["hotspot:utc:zh_CN:2026-05-13T18:market"],
      deferredBatch: true,
    });
    expect(payload.residentPrewarmAttempts).toEqual([
      expect.objectContaining({
        candidateType: "market_overview",
        candidateKey: "market_overview:utc:zh_CN:2026-05-13T18",
        locale: "zh_CN",
        why: "fixed_cadence",
        outputCount: 1,
        spentInlineSlot: true,
        lockedSkip: false,
      }),
    ]);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        triggerSource: "cron",
        locale: "zh_CN",
        candidate: expect.objectContaining({
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-13T18",
        }),
        now: prewarmNow,
      }),
    );
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ candidate: expect.objectContaining({ candidateType: "hotspot" }) }),
    );
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "batch" }),
    );
  });

  it("does not spend the inline cap on resident candidates skipped by an existing lock", async () => {
    const prewarmNow = Date.parse("2026-05-13T18:00:00.000Z");
    vi.setSystemTime(prewarmNow);
    runPmDecisionJobMock
      .mockResolvedValueOnce({
        job: { id: "pm-job:market-locked", status: "succeeded" },
        outputs: [],
        auditEvents: [
          {
            type: "candidate_skipped",
            triggerSource: "cron",
            locale: "zh_CN",
            symbol: "market_overview:utc:zh_CN:2026-05-13T18",
            reason: "locked",
          },
        ],
      })
      .mockResolvedValueOnce({
        job: { id: "pm-job:hotspot-generated", status: "succeeded" },
        outputs: [
          {
            record: { id: "pm:HOTSPOT:test" },
            publicTimelineEntry: displayablePmTimelineEntry({
              id: "pm-decision:pm:HOTSPOT:test",
              payload: {
                kind: "pm_decision",
                recordId: "pm:HOTSPOT:test",
                symbol: "HOTSPOT",
                candidateType: "hotspot",
                candidateKey: "hotspot:utc:zh_CN:2026-05-13T18:market",
                displayTitle: "热点叙事追踪",
                executable: false,
                tradeDecision: null,
                rounds: [
                  {
                    round: 1,
                    memberId: "news_analyst",
                    rationale: "热点叙事具备公开信息收集发言",
                  },
                ],
              },
            }),
            tradeDecision: {},
          },
        ],
        auditEvents: [],
      });

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarmGenerated).toBe(1);
    expect(payload.pmDecisionInlineLimit).toEqual({
      limit: 1,
      used: 1,
      deferredResidentCandidateKeys: [],
      deferredBatch: true,
    });
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        candidate: expect.objectContaining({
          candidateType: "market_overview",
        }),
      }),
    );
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        candidate: expect.objectContaining({
          candidateType: "hotspot",
        }),
      }),
    );
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "batch" }),
    );
  });

  it("spends the inline cap on an attempted resident candidate that produces no output", async () => {
    const prewarmNow = Date.parse("2026-05-13T18:00:00.000Z");
    vi.setSystemTime(prewarmNow);
    runPmDecisionJobMock
      .mockResolvedValueOnce({
        job: { id: "pm-job:market-skipped", status: "succeeded" },
        outputs: [],
        auditEvents: [],
      })
      .mockResolvedValueOnce({
        job: { id: "pm-job:hotspot-generated", status: "succeeded" },
        outputs: [
          {
            record: { id: "pm:HOTSPOT:test" },
            publicTimelineEntry: displayablePmTimelineEntry({
              id: "pm-decision:pm:HOTSPOT:test",
              payload: {
                kind: "pm_decision",
                recordId: "pm:HOTSPOT:test",
                symbol: "HOTSPOT",
                candidateType: "hotspot",
                candidateKey: "hotspot:utc:zh_CN:2026-05-13T18:market",
                displayTitle: "热点叙事追踪",
                executable: false,
                tradeDecision: null,
                rounds: [
                  {
                    round: 1,
                    memberId: "news_analyst",
                    rationale: "热点叙事具备公开信息收集发言",
                  },
                ],
              },
            }),
            tradeDecision: {},
          },
        ],
        auditEvents: [],
      });

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarmGenerated).toBe(0);
    expect(payload.pmDecisionInlineLimit).toEqual({
      limit: 1,
      used: 1,
      deferredResidentCandidateKeys: ["hotspot:utc:zh_CN:2026-05-13T18:market"],
      deferredBatch: true,
    });
    expect(payload.residentPrewarmAttempts).toEqual([
      expect.objectContaining({
        candidateType: "market_overview",
        candidateKey: "market_overview:utc:zh_CN:2026-05-13T18",
        locale: "zh_CN",
        why: "fixed_cadence",
        outputCount: 0,
        spentInlineSlot: true,
        lockedSkip: false,
      }),
    ]);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        candidate: expect.objectContaining({
          candidateType: "market_overview",
        }),
      }),
    );
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        candidate: expect.objectContaining({
          candidateType: "hotspot",
        }),
      }),
    );
    expect(enqueuePmDecisionJobMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "batch" }),
    );
  });

  it("backfills due failed resident prewarm jobs outside the fixed UTC cadence window", async () => {
    const retryNow = Date.parse("2026-05-13T20:10:00.000Z");
    vi.setSystemTime(retryNow);
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      residentDecisionRecord("market_overview", "2026-05-13T18:30:00.000Z"),
    ]);
    readPmDecisionJobsMock.mockResolvedValueOnce([
      {
        id: "pm-job:hotspot:failed",
        schemaVersion: 1,
        kind: "once",
        status: "failed",
        triggerSource: "cron",
        locale: "zh_CN",
        idempotencyKey: "once:cron:zh_CN:hotspot:failed",
        candidate: {
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-13T18:market",
          displayTitle: "热点叙事追踪",
          executable: false,
          cadence: "intraday",
          score: 80,
          reasons: [],
        },
        symbol: null,
        createdAt: "2026-05-13T18:00:00.000Z",
        updatedAt: "2026-05-13T18:05:00.000Z",
        startedAt: "2026-05-13T18:00:00.000Z",
        completedAt: "2026-05-13T18:05:00.000Z",
        attemptCount: 1,
        maxAttempts: 3,
        nextRunAt: "2026-05-13T20:00:00.000Z",
        lastError: "provider timeout",
        outputCount: 0,
        decisionRecordIds: [],
        auditEventCount: 0,
      },
    ]);

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarmCandidates).toEqual(["hotspot:utc:zh_CN:2026-05-13T18:market"]);
    expect(payload.residentPrewarmBackfillCandidates).toEqual([
      "hotspot:utc:zh_CN:2026-05-13T18:market",
    ]);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        triggerSource: "cron",
        locale: "zh_CN",
        candidate: expect.objectContaining({
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-13T18:market",
        }),
        now: retryNow,
      }),
    );
  });

  it("fills a missing market overview outside the fixed UTC cadence window when records are readable", async () => {
    const retryNow = Date.parse("2026-05-13T20:10:00.000Z");
    vi.setSystemTime(retryNow);
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:HOTSPOT:2026-05-13T19:00:00.000Z",
        schemaVersion: 2,
        recordSource: "paper",
        symbol: "HOTSPOT",
        candidate: {
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-13T18:market",
          displayTitle: "热点叙事追踪",
          executable: false,
          cadence: "intraday",
          score: 80,
          reasons: [],
        },
        locale: "zh_CN",
        tradeDecision: null,
        createdAt: "2026-05-13T19:00:00.000Z",
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarmCandidates).toEqual(["market_overview:utc:zh_CN:2026-05-13T18"]);
    expect(payload.residentPrewarmBackfillCandidates).toEqual([
      "market_overview:utc:zh_CN:2026-05-13T18",
    ]);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "once",
        triggerSource: "cron",
        locale: "zh_CN",
        candidate: expect.objectContaining({
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-13T18",
        }),
        now: retryNow,
      }),
    );
  });

  it("does not first-fill resident prewarm candidates when decision records cannot be read", async () => {
    const retryNow = Date.parse("2026-05-13T20:10:00.000Z");
    vi.setSystemTime(retryNow);
    readAllDecisionRecordsMock.mockRejectedValueOnce(new Error("kv unavailable"));

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.residentPrewarmCandidates).toEqual([]);
    expect(payload.residentPrewarmBackfillCandidates).toEqual([]);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledTimes(1);
    expect(enqueuePmDecisionJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "batch",
        triggerSource: "cron",
      }),
    );
  });

  it("queues scheduled cron PM jobs instead of blocking on the PM pipeline when queue is available", async () => {
    publishPmDecisionJobToQueueMock.mockResolvedValueOnce({
      mode: "queue",
      messageId: "msg_cron_pm",
    });

    const response = await GET(new NextRequest("https://claw42.ai/api/cron/strategy-replay"));
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: true,
      pmDecisionGenerated: false,
      generatedPmDecisions: 0,
      pmDecisionJobId: "pm-job:test",
      pmDecisionJobStatus: "queued",
      pmDecisionQueueMode: "queue",
    });
    expect(publishPmDecisionJobToQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm-job:test", kind: "batch" }),
      expect.objectContaining({ now }),
    );
    expect(runPmDecisionJobMock).not.toHaveBeenCalled();
  });

  it("continues resolving later PM decisions when one record write fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      getCoinPoolMock.mockResolvedValueOnce({
        ...pool(),
        tickers: {
          ...pool().tickers,
          ETH: { price: 4200, change24h: 0.5 },
        },
        majors: [
          ...pool().majors,
          { symbol: "ETH", price: 4200, change24h: 0.5, category: "majors" },
        ],
      });
      readAllDecisionRecordsMock.mockResolvedValueOnce([
        {
          id: "pm:BTC:open",
          symbol: "BTC",
          tradeDecision: { id: "trade:BTC:open" },
          resolvedOutcome: null,
        },
        {
          id: "pm:ETH:open",
          symbol: "ETH",
          tradeDecision: { id: "trade:ETH:open" },
          resolvedOutcome: null,
        },
      ]);
      resolveDecisionRecordFromPriceMock
        .mockRejectedValueOnce(new Error("write failed"))
        .mockResolvedValueOnce({
          record: { id: "pm:ETH:open", resolvedOutcome: "hit_tp" },
          resolution: { outcome: "hit_tp" },
        });

      const response = await GET(
        new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
      );
      const payload = await response.json();

      expect(payload.resolvedPmDecisions).toBe(1);
      expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledTimes(2);
      expect(resolveDecisionRecordFromPriceMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: "pm:ETH:open" }),
        4200,
        expect.any(Number),
        undefined,
        "coinw-kline",
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("normalizes open PM decision symbols before resolving against the CoinW pool", async () => {
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:BTC:dirty-symbol",
        symbol: " $btc ",
        tradeDecision: { id: "trade:BTC:open" },
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:dirty-symbol" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
  });

  it("falls back to trade decision symbol when the record symbol is unusable", async () => {
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:BTC:legacy-unknown-symbol",
        symbol: "UNKNOWN",
        tradeDecision: { id: "trade:BTC:open", symbol: " $btc " },
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:legacy-unknown-symbol" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
  });

  it("does not re-evaluate already manually closed PM decisions", async () => {
    readAllDecisionRecordsMock.mockResolvedValueOnce([
      {
        id: "pm:BTC:manual-close",
        symbol: "BTC",
        tradeDecision: { id: "trade:BTC:manual-close", symbol: "BTC" },
        resolvedOutcome: "manual_close",
      },
      {
        id: "pm:BTC:open",
        symbol: "BTC",
        tradeDecision: { id: "trade:BTC:open", symbol: "BTC" },
        resolvedOutcome: null,
      },
    ]);

    const response = await GET(
      new NextRequest("https://claw42.ai/api/cron/strategy-replay?trigger=now"),
    );
    const payload = await response.json();

    expect(payload.resolvedPmDecisions).toBe(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledTimes(1);
    expect(resolveDecisionRecordFromPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm:BTC:open" }),
      101000,
      expect.any(Number),
      undefined,
      "coinw-kline",
    );
  });
});

function residentDecisionRecord(candidateType: "market_overview" | "hotspot", createdAt: string) {
  return {
    id: `pm:${candidateType}:${createdAt}`,
    schemaVersion: 2,
    recordSource: "paper",
    symbol: candidateType === "market_overview" ? "MARKET" : "HOTSPOT",
    candidate: {
      candidateType,
      candidateKey: `${candidateType}:utc:zh_CN:${createdAt}`,
      displayTitle: candidateType === "market_overview" ? "今日大盘综述" : "热点叙事追踪",
      executable: false,
      cadence: candidateType === "market_overview" ? "daily" : "intraday",
      score: 100,
      reasons: [],
    },
    locale: "zh_CN",
    tradeDecision: null,
    createdAt,
    resolvedOutcome: null,
  };
}
