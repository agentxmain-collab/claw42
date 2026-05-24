import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    __resetWatchHistoryForTests();
    __decisionRecordStoreTestUtils.clearMemoryRecords();
  });

  afterEach(async () => {
    delete process.env.DECISION_RECORD_STORE_DIR;
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

  it("keeps one stale-but-real resident market and hotspot record as a public floor", () => {
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
    ).toEqual(["market-latest", "hotspot-latest"]);
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

function decisionRecord(id: string, ts: number): StrategyDecisionRecord {
  return {
    id,
    schemaVersion: 1,
    recordSource: "live",
    symbol: "BTC",
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
    tradeDecision: null,
    createdAt: new Date(ts).toISOString(),
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test",
    modelProvider: "stub",
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
