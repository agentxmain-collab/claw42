import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { waitUntil } from "@vercel/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import {
  __decisionRecordStoreTestUtils,
  appendDecisionRecord,
} from "@/lib/team/decisionRecordStore";
import { appendWatchHistoryEntry, __resetWatchHistoryForTests } from "@/lib/watchHistoryStore";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  buildWatchTimelinePayload,
  MAX_PUBLIC_TIMELINE_WINDOW_MINUTES,
  type PublicWatchTimelinePayload,
  resolvePublicTimelineRecordCutoff,
  selectResidentFloorRecordEvents,
  selectSymbolFloorRecordEvents,
} from "@/lib/watch/publicTimelinePayload";
import type { StreamEntry, WatchEntryMeta } from "@/modules/agent-watch/types";
import { readPublicCardIndexPage } from "@/lib/watch/publicCardIndex";

const waitUntilMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/functions", () => ({
  waitUntil: waitUntilMock,
}));

let tempDir: string;

function pmEvent(
  id: string,
  ts: number,
  candidateType: "symbol" | "market_overview" | "hotspot",
  symbol = "BTC",
): PublicTimelineEvent {
  return {
    id,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: [],
    locale: "zh_CN",
    payload: {
      kind: "pm_decision",
      recordId: `record-${id}`,
      symbol:
        candidateType === "market_overview"
          ? "MARKET"
          : candidateType === "hotspot"
            ? "HOTSPOT"
            : symbol,
      candidateType,
      candidateKey: `${candidateType}:zh_CN:${id}`,
      displayTitle: id,
      executable: candidateType === "symbol",
      tradeDecision: null,
      rationaleByMember: {},
    },
  };
}

describe("publicTimelinePayload", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "claw42-public-timeline-payload-"));
    process.env.DECISION_RECORD_STORE_DIR = tempDir;
    delete process.env.USE_PERSISTENT_KV;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.VERCEL;
    __resetWatchHistoryForTests();
    __decisionRecordStoreTestUtils.clearMemoryRecords();
    waitUntilMock.mockReset();
  });

  afterEach(async () => {
    delete process.env.DECISION_RECORD_STORE_DIR;
    delete process.env.VERCEL;
    await rm(tempDir, { recursive: true, force: true });
    __resetWatchHistoryForTests();
    __decisionRecordStoreTestUtils.clearMemoryRecords();
  });

  it("keeps the public record backfill window at 24 hours", () => {
    const servedAt = Date.UTC(2026, 4, 18, 1, 30, 0);

    expect(resolvePublicTimelineRecordCutoff(servedAt, 24 * 60)).toBe(
      servedAt - MAX_PUBLIC_TIMELINE_WINDOW_MINUTES * 60_000,
    );
  });

  it("caps oversized public record backfill windows at 24 hours", () => {
    const servedAt = Date.UTC(2026, 4, 18, 1, 30, 0);

    expect(resolvePublicTimelineRecordCutoff(servedAt, 48 * 60)).toBe(
      servedAt - MAX_PUBLIC_TIMELINE_WINDOW_MINUTES * 60_000,
    );
  });

  it("does not publish resident market and hotspot records as a public floor", () => {
    const servedAt = Date.UTC(2026, 4, 18, 12, 0, 0);
    const before = servedAt + 1;
    const events = [
      pmEvent("market-old", servedAt - 34 * 60 * 60_000, "market_overview"),
      pmEvent("market-latest", servedAt - 30 * 60 * 60_000, "market_overview"),
      pmEvent("hotspot-latest", servedAt - 26 * 60 * 60_000, "hotspot"),
      pmEvent("symbol-old", servedAt - 30 * 60 * 60_000, "symbol"),
      pmEvent("market-too-old", servedAt - 80 * 60 * 60_000, "market_overview"),
    ];

    expect(
      selectResidentFloorRecordEvents(events, {
        locale: "zh_CN",
        before,
        servedAt,
      }).map((event) => event.id),
    ).toEqual([]);
  });

  it("publishes news-driven symbol records beyond the previous six-hour visibility gate", async () => {
    const servedAt = Date.UTC(2026, 4, 24, 6, 20, 0);
    await appendDecisionRecord(
      decisionRecord("pm:BTC:fresh", servedAt - 10 * 60_000, {
        candidateKey: "news-driven:BTC:fresh",
        promptVersion: "simple-pipeline:v1",
        modelProvider: "simple-pipeline",
      }),
    );
    await appendDecisionRecord(
      decisionRecord("pm:ETH:old", servedAt - 16 * 60 * 60_000, {
        candidateKey: "news-driven:ETH:old",
        promptVersion: "simple-pipeline:v1",
        modelProvider: "simple-pipeline",
        symbol: "ETH",
      }),
    );
    await appendDecisionRecord(
      decisionRecord("pm:SOL:legacy", servedAt - 5 * 60_000, {
        candidateKey: "SOL",
        symbol: "SOL",
      }),
    );
    await appendDecisionRecord(
      decisionRecord("pm:market:latest", servedAt - 5 * 60_000, {
        candidateType: "market_overview",
        candidateKey: "market_overview:zh_CN:latest",
        symbol: "MARKET",
      }),
    );

    const payload = (await buildWatchTimelinePayload({
      mode: "public",
      locale: "zh_CN",
      before: servedAt + 1,
      limit: 10,
      windowMinutes: 24 * 60,
      servedAt,
    })) as PublicWatchTimelinePayload;

    const recordIds = payload.events.flatMap((event) =>
      event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
    );
    expect(recordIds).toEqual(expect.arrayContaining(["pm:BTC:fresh", "pm:ETH:old"]));
  });

  it("widens the fallback record window to seventy two hours when the compact index is empty", async () => {
    const servedAt = Date.UTC(2026, 4, 24, 6, 20, 0);
    await appendDecisionRecord(
      decisionRecord("pm:market:old", servedAt - 48 * 60 * 60_000, {
        candidateType: "market_overview",
        candidateKey: "market_overview:zh_CN:old",
        symbol: "MARKET",
      }),
    );

    const payload = (await buildWatchTimelinePayload({
      mode: "public",
      locale: "zh_CN",
      before: servedAt + 1,
      limit: 10,
      windowMinutes: 60,
      servedAt,
    })) as PublicWatchTimelinePayload;

    const recordIds = payload.events.flatMap((event) =>
      event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
    );
    expect(recordIds).toContain("pm:market:old");
    expect(payload.windowMinutes).toBe(72 * 60);
  });

  it("runs empty-index backfill inline outside Vercel", async () => {
    const servedAt = Date.UTC(2026, 4, 24, 6, 20, 0);
    await appendDecisionRecord(
      decisionRecord("pm:BTC:inline-backfill", servedAt - 60_000, {
        candidateKey: "news-driven:BTC:inline-backfill",
      }),
    );

    await buildWatchTimelinePayload({
      mode: "public",
      locale: "zh_CN",
      before: servedAt + 1,
      limit: 10,
      windowMinutes: 60,
      servedAt,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 10 });

    expect(waitUntil).not.toHaveBeenCalled();
    expect(page.totalCount).toBe(0);
  });

  it("does not schedule GET-time public index backfill in deployed runtimes", async () => {
    process.env.VERCEL = "1";
    const servedAt = Date.UTC(2026, 4, 24, 6, 20, 0);
    await appendDecisionRecord(
      decisionRecord("pm:BTC:waituntil-backfill", servedAt - 60_000, {
        candidateKey: "news-driven:BTC:waituntil-backfill",
      }),
    );

    await buildWatchTimelinePayload({
      mode: "public",
      locale: "zh_CN",
      before: servedAt + 1,
      limit: 10,
      windowMinutes: 60,
      servedAt,
    });

    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("keeps up to three stale-but-real executable symbol records as a public floor", () => {
    const servedAt = Date.UTC(2026, 4, 18, 12, 0, 0);
    const before = servedAt + 1;
    const events = [
      pmEvent("btc-old", servedAt - 34 * 60 * 60_000, "symbol", "BTC"),
      pmEvent("btc-latest", servedAt - 30 * 60 * 60_000, "symbol", "BTC"),
      pmEvent("eth-latest", servedAt - 28 * 60 * 60_000, "symbol", "ETH"),
      pmEvent("sol-latest", servedAt - 26 * 60 * 60_000, "symbol", "SOL"),
      pmEvent("btc-too-old", servedAt - 80 * 60 * 60_000, "symbol", "BTC"),
      {
        ...pmEvent("irys-watch-only", servedAt - 24 * 60 * 60_000, "symbol", "IRYS"),
        payload: {
          ...(pmEvent("irys-watch-only", servedAt - 24 * 60 * 60_000, "symbol", "IRYS")
            .payload as Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>),
          executable: false,
        },
      },
    ];

    expect(
      selectSymbolFloorRecordEvents(events, {
        locale: "zh_CN",
        before,
        servedAt,
      }).map((event) => event.id),
    ).toEqual(["sol-latest", "eth-latest", "btc-latest"]);
  });

  it("does not surface PM history entries whose decision record cannot be hydrated", async () => {
    const servedAt = Date.UTC(2026, 4, 24, 6, 20, 0);
    await appendWatchHistoryEntry(pmHistoryEntry("pm:BTC:1779601515817", servedAt - 60_000));

    const payload = (await buildWatchTimelinePayload({
      mode: "public",
      locale: "zh_CN",
      before: servedAt + 1,
      limit: 10,
      windowMinutes: 60,
      servedAt,
    })) as PublicWatchTimelinePayload;

    expect(
      payload.events.flatMap((event) =>
        event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
      ),
    ).toEqual([]);
  });

  it("hydrates PM history entries from complete decision records before public display", async () => {
    const servedAt = Date.UTC(2026, 4, 24, 6, 20, 0);
    const record = decisionRecord("pm:BTC:1779601515817", servedAt - 60_000);
    await appendDecisionRecord(record);
    await appendWatchHistoryEntry(pmHistoryEntry(record.id, servedAt - 60_000));

    const payload = (await buildWatchTimelinePayload({
      mode: "public",
      locale: "zh_CN",
      before: servedAt + 1,
      limit: 10,
      windowMinutes: 60,
      servedAt,
    })) as PublicWatchTimelinePayload;

    expect(
      payload.events.flatMap((event) =>
        event.payload.kind === "pm_decision" ? [event.payload.recordId] : [],
      ),
    ).toEqual([record.id]);
    const pmEvent = payload.events.find(
      (
        event,
      ): event is PublicTimelineEvent & {
        payload: Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>;
      } => event.payload.kind === "pm_decision",
    );
    expect(pmEvent?.payload.stageTrace?.map((stage) => `${stage.stageId}:${stage.status}`)).toEqual(
      ["analyst_inputs:done"],
    );
  });
});

function pmHistoryEntry(recordId: string, ts: number): StreamEntry & { meta: WatchEntryMeta } {
  return {
    kind: "chat_thread",
    id: `thread-${recordId}`,
    ts,
    thread: {
      id: `thread-${recordId}`,
      seed: {
        id: `seed-${recordId}`,
        type: "market",
        title: "BTC PM decision",
        description: "PM decision",
        symbols: ["BTC"],
        sentiment: "neutral",
        createdAt: ts,
      },
      messages: [],
      strategy: null,
      status: "completed",
      createdAt: ts,
      completedAt: ts,
      symbol: "BTC",
    },
    meta: {
      visibility: "public",
      importance: "high",
      sourceTrigger: "pm_decision",
      evidenceIds: [],
      locale: "zh_CN",
      recordId,
      tradeDecision: null,
    },
  };
}

function decisionRecord(
  id: string,
  ts: number,
  overrides: {
    candidateType?: "symbol" | "market_overview" | "hotspot";
    candidateKey?: string;
    symbol?: string;
    promptVersion?: string;
    modelProvider?: string;
  } = {},
): StrategyDecisionRecord {
  const symbol = overrides.symbol ?? "BTC";
  const promptVersion = overrides.promptVersion ?? "simple-pipeline:v1";
  const modelProvider = overrides.modelProvider ?? "simple-pipeline";
  return {
    id,
    schemaVersion: 1,
    recordSource: "live",
    symbol,
    candidate: {
      candidateType: overrides.candidateType ?? "symbol",
      candidateKey: overrides.candidateKey ?? `news-driven:${symbol}:${id}`,
      displayTitle:
        overrides.candidateType === "market_overview" ? "今日大盘综述" : `${symbol} 实时行情分析`,
      executable: (overrides.candidateType ?? "symbol") === "symbol",
      cadence: "event",
      score: 80,
      reasons: [],
    },
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["fundamental_analyst"],
    analystInputs: [
      {
        memberId: "fundamental_analyst",
        direction: "long",
        confidence: 0.7,
        rationale: "BTC spot demand is improving near 76000.",
        evidenceIds: [],
      },
    ],
    sourceThreadId: `thread-${id}`,
    tradeDecision:
      (overrides.candidateType ?? "symbol") === "symbol"
        ? {
            id: `trade-${id}`,
            schemaVersion: 1,
            symbol,
            generatedBy: "pm",
            generatedAt: new Date(ts).toISOString(),
            direction: "short",
            entryType: "market",
            entryPrice: 76000,
            entryRange: null,
            stopLoss: 77000,
            takeProfit: [74000],
            positionSizing: 0.08,
            timeHorizon: "intraday",
            rating: 4,
            confidence: 0.68,
            evidenceIds: [],
            riskNote: "Risk is bounded by stop loss.",
            invalidatesIf: "BTC reclaims resistance.",
            promptVersion,
            modelProvider,
            severity: "medium",
          }
        : null,
    createdAt: new Date(ts).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion,
    modelProvider,
    legacyFactionId: null,
    stageTrace: [
      {
        stageId: "analyst_inputs",
        label: "Analyst input generation",
        status: "done",
        observedAt: new Date(ts).toISOString(),
      },
    ],
  };
}
