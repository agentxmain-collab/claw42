import { describe, expect, it, vi } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import {
  __publicCardIndexTestUtils,
  backfillPublicCardIndexFromRecords,
  buildPublicCardIndexEntry,
  cleanupPublicCardIndex,
  hasPublicStrategy,
  PUBLIC_CARD_RETENTION_MS,
  PUBLIC_CARD_TOTAL_CAP,
  prunePublicCardIndexByStrategy,
  publicCardIndexKey,
  publicCardIndexWriteFailureLogKey,
  readPublicCardIndexRange,
  readPublicCardIndexPage,
  readPublicCardIndexWriteFailureMarkers,
  rebuildPublicCardIndexFromRecords,
  writePublicCardIndexFailureMarker,
  writePublicCardIndexEntry,
} from "@/lib/watch/publicCardIndex";

describe("publicCardIndex", () => {
  it("indexes records as soon as a concrete public strategy exists", () => {
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);

    expect(buildPublicCardIndexEntry(makeRecord(1, now, { tradeDirection: "long" }))).toMatchObject(
      { decisionDir: "long" },
    );
    expect(
      buildPublicCardIndexEntry(makeRecord(2, now, { tradeDirection: "short" })),
    ).toMatchObject({ decisionDir: "short" });
    expect(buildPublicCardIndexEntry(makeRecord(3, now, { tradeDirection: "wait" }))).toBeNull();
    expect(buildPublicCardIndexEntry(makeRecord(4, now, { resolvedAt: null }))).toMatchObject({
      decisionDir: "short",
      resolvedAt: null,
    });
    expect(
      buildPublicCardIndexEntry(
        makeRecord(5, now, { tradeDirection: null, analystDirection: "neutral" }),
      ),
    ).toBeNull();
    expect(
      buildPublicCardIndexEntry(
        makeRecord(6, now, { tradeDirection: null, analystDirection: "long" }),
      ),
    ).toBeNull();
    expect(
      buildPublicCardIndexEntry(makeRecord(7, now, { tradePatch: { entryPrice: null } })),
    ).toBeNull();
    expect(
      buildPublicCardIndexEntry(makeRecord(8, now, { tradePatch: { stopLoss: null } })),
    ).toBeNull();
    expect(
      buildPublicCardIndexEntry(makeRecord(9, now, { tradePatch: { takeProfit: [] } })),
    ).toBeNull();
    expect(hasPublicStrategy(makeRecord(10, now, { resolvedAt: null }))).toBe(true);
  });

  it("reads latest cards by zset page", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);

    for (let index = 0; index < 20; index += 1) {
      await writePublicCardIndexEntry(makeRecord(index, now + index * 1000), { client });
    }

    const page = await readPublicCardIndexPage("zh_CN", {
      page: 2,
      pageSize: 5,
      client,
    });

    expect(page.entries.map((entry) => entry.id)).toEqual([
      "pm-decision:pm:BTC:14",
      "pm-decision:pm:BTC:13",
      "pm-decision:pm:BTC:12",
      "pm-decision:pm:BTC:11",
      "pm-decision:pm:BTC:10",
    ]);
    expect(page.totalCount).toBe(20);
    expect(page.hasMore).toBe(true);
  });

  it("reads a deep finite range beyond the old 100-entry page cap in three KV commands", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);

    for (let index = 0; index < 180; index += 1) {
      await writePublicCardIndexEntry(makeRecord(index, now + index * 1000), { client });
    }
    client.calls.length = 0;

    const range = await readPublicCardIndexRange("zh_CN", {
      offset: 30,
      limit: 135,
      client,
    });

    expect(range.entries).toHaveLength(135);
    expect(range.totalCount).toBe(180);
    expect(range.hasMore).toBe(true);
    expect(client.calls.map((call) => call.name)).toEqual(["zrange", "zcard", "zrange"]);
  });

  it("keeps a bounded write-failure marker log per locale", async () => {
    const client = createFailureLogClient();

    await writePublicCardIndexFailureMarker(
      {
        recordId: "record-1",
        locale: "zh_CN",
        symbol: "BTC",
        recordCreatedAt: "2026-05-28T07:00:00.000Z",
        failedAt: "2026-05-28T07:01:00.000Z",
        stage: "public-card-index",
        error: "zadd failed",
      },
      { client, cap: 1 },
    );
    await writePublicCardIndexFailureMarker(
      {
        recordId: "record-2",
        locale: "zh_CN",
        symbol: "ETH",
        recordCreatedAt: "2026-05-28T07:02:00.000Z",
        failedAt: "2026-05-28T07:03:00.000Z",
        stage: "direct-record",
        error: "direct write failed",
      },
      { client, cap: 1 },
    );

    const markers = await readPublicCardIndexWriteFailureMarkers("zh_CN", { client, limit: 10 });

    expect(markers.map((marker) => marker.recordId)).toEqual(["record-2"]);
    expect(client.store.has(publicCardIndexWriteFailureLogKey("zh_CN"))).toBe(true);
  });

  it("cleans cards older than sixty days", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);
    const tooOld = now - PUBLIC_CARD_RETENTION_MS - 1;

    await writePublicCardIndexEntry(makeRecord(1, tooOld), { client });
    await writePublicCardIndexEntry(makeRecord(2, now - PUBLIC_CARD_RETENTION_MS + 1), {
      client,
    });

    await cleanupPublicCardIndex("zh_CN", { client, now });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 10, client });

    expect(page.entries.map((entry) => entry.id)).toEqual(["pm-decision:pm:BTC:2"]);
  });

  it("does not scan direct records during normal write cleanup", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const readRecord = vi.fn();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);

    await writePublicCardIndexEntry(makeRecord(1, now), { client });
    const result = await cleanupPublicCardIndex("zh_CN", {
      client,
      now,
      readRecord,
    });

    expect(readRecord).not.toHaveBeenCalled();
    expect(result.removedByNonStrategy).toBe(0);
    expect(client.calls.map((call) => call.name)).toEqual(["zadd", "zremrangebyscore", "zcard"]);
  });

  it("keeps only the latest eight thousand cards when the safety cap is exceeded", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);

    for (let index = 0; index < PUBLIC_CARD_TOTAL_CAP + 25; index += 1) {
      await writePublicCardIndexEntry(makeRecord(index, now + index), { client });
    }

    await cleanupPublicCardIndex("zh_CN", { client, now: now + PUBLIC_CARD_TOTAL_CAP + 25 });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 1, client });
    const tail = await readPublicCardIndexPage("zh_CN", {
      page: PUBLIC_CARD_TOTAL_CAP,
      pageSize: 1,
      client,
    });

    expect(page.totalCount).toBe(PUBLIC_CARD_TOTAL_CAP);
    expect(page.entries[0]?.id).toBe(`pm-decision:pm:BTC:${PUBLIC_CARD_TOTAL_CAP + 24}`);
    expect(tail.entries[0]?.id).toBe("pm-decision:pm:BTC:25");
  });

  it("backfills raw decision records into the public card index", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);
    const records = Array.from({ length: 50 }, (_, index) => makeRecord(index, now + index * 1000));

    const result = await backfillPublicCardIndexFromRecords(records, {
      locale: "zh_CN",
      client,
      now,
      persistRecord: async () => null,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 50, client });

    expect(result).toMatchObject({
      ok: true,
      locale: "zh_CN",
      recordsScanned: 50,
      recordsWritten: 50,
      indexCountAfter: 50,
    });
    expect(page.totalCount).toBe(50);
    expect(page.entries).toHaveLength(50);
  });

  it("keeps public card backfill idempotent for repeated runs", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);
    const records = Array.from({ length: 50 }, (_, index) => makeRecord(index, now + index * 1000));

    await backfillPublicCardIndexFromRecords(records, {
      locale: "zh_CN",
      client,
      now,
      persistRecord: async () => null,
    });
    const second = await backfillPublicCardIndexFromRecords(records, {
      locale: "zh_CN",
      client,
      now,
      persistRecord: async () => null,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 100, client });

    expect(second.indexCountAfter).toBe(50);
    expect(page.totalCount).toBe(50);
  });

  it("runs age cleanup after backfill", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);
    const tooOld = now - PUBLIC_CARD_RETENTION_MS - 1;
    for (let index = 0; index < 5; index += 1) {
      await writePublicCardIndexEntry(makeRecord(100 + index, tooOld - index), { client });
    }

    const result = await backfillPublicCardIndexFromRecords([makeRecord(1, now)], {
      locale: "zh_CN",
      client,
      now,
      persistRecord: async () => null,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 10, client });

    expect(result.removedByAge).toBe(5);
    expect(page.totalCount).toBe(1);
    expect(page.entries[0]?.id).toBe("pm-decision:pm:BTC:1");
  });

  it("prunes indexed cards without a concrete public strategy", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);
    const validLong = makeRecord(1, now, { tradeDirection: "long" });
    const validShort = makeRecord(2, now + 1000, { tradeDirection: "short" });
    const unresolved = makeRecord(3, now + 2000, {
      tradeDirection: "long",
      resolvedAt: null,
    });
    const wait = makeRecord(4, now + 3000, { tradeDirection: "wait" });
    const neutral = makeRecord(5, now + 4000, {
      tradeDirection: null,
      analystDirection: "neutral",
    });
    const invalidEntry = makeRecord(6, now + 5000, {
      tradeDirection: "long",
      tradePatch: { entryPrice: null },
    });
    const records = new Map(
      [validLong, validShort, unresolved, wait, neutral, invalidEntry].map((record) => [
        `claw42:strategy:record-by-id:v1:zh_CN:${encodeURIComponent(record.id)}`,
        record,
      ]),
    );

    for (const record of [validLong, validShort, unresolved]) {
      await writePublicCardIndexEntry(record, { client });
    }
    await addRawIndexedEntry(client, wait, "wait");
    await addRawIndexedEntry(client, neutral, null);
    await addRawIndexedEntry(client, invalidEntry, "long");

    const removed = await prunePublicCardIndexByStrategy("zh_CN", {
      client,
      readRecord: async (entry) => records.get(entry.recordKey) ?? null,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 10, client });

    expect(removed).toBe(3);
    expect(page.totalCount).toBe(3);
    expect(page.entries.map((entry) => entry.id).sort()).toEqual([
      "pm-decision:pm:BTC:1",
      "pm-decision:pm:BTC:2",
      "pm-decision:pm:BTC:3",
    ]);
  });

  it("rebuilds the public card index by adding eligible records and removing stale members", async () => {
    const client = __publicCardIndexTestUtils.createMemoryClient();
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);
    const existing = makeRecord(1, now, { tradeDirection: "long" });
    const added = makeRecord(2, now + 1000, { tradeDirection: "short", resolvedAt: null });
    const wait = makeRecord(3, now + 2000, { tradeDirection: "wait" });
    const noTrade = makeRecord(4, now + 3000, { tradeDirection: null, analystDirection: "long" });

    await writePublicCardIndexEntry(existing, { client });
    await addRawIndexedEntry(client, wait, "wait");

    const result = await rebuildPublicCardIndexFromRecords([existing, added, wait, noTrade], {
      locale: "zh_CN",
      client,
      persistRecord: async () => null,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 10, client });

    expect(result).toMatchObject({
      ok: true,
      recordsRead: 4,
      candidateCount: 2,
      addedCount: 1,
      removedCount: 1,
      kept: 1,
      alreadyIndexed: 1,
      skippedNonStrategy: 2,
      errors: 0,
    });
    expect(page.entries.map((entry) => entry.id).sort()).toEqual([
      "pm-decision:pm:BTC:1",
      "pm-decision:pm:BTC:2",
    ]);
  });
});

type MakeRecordOptions = {
  tradeDirection?: "long" | "short" | "wait" | null;
  analystDirection?: "long" | "short" | "neutral" | "wait";
  resolvedAt?: string | null;
  tradePatch?: Partial<NonNullable<StrategyDecisionRecord["tradeDecision"]>>;
};

function makeRecord(
  index: number,
  createdAtMs: number,
  {
    tradeDirection = "short",
    analystDirection = "short",
    resolvedAt,
    tradePatch,
  }: MakeRecordOptions = {},
): StrategyDecisionRecord {
  const id = `pm:BTC:${index}`;
  const createdAt = new Date(createdAtMs).toISOString();
  const resolvedAtValue = resolvedAt === undefined ? createdAt : resolvedAt;
  return {
    id,
    schemaVersion: 2,
    recordSource: "live",
    symbol: "BTC",
    candidate: {
      candidateType: "symbol",
      candidateKey: `news-driven:BTC:${index}`,
      symbol: "BTC",
      displayTitle: "BTC news",
      executable: true,
      cadence: "event",
      score: 1,
      reasons: [],
    },
    analysisSummary: "BTC news-driven setup.",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["news_analyst", "pm"],
    analystInputs: [
      {
        memberId: "news_analyst",
        direction: analystDirection,
        confidence: 0.7,
        rationale: "BTC weakens after news.",
        evidenceIds: [`ev_${index}`],
      },
    ],
    stageTrace: [
      {
        stageId: "analyst_inputs",
        label: "analysis",
        status: "done",
        observedAt: createdAt,
      },
      {
        stageId: "research_lead",
        label: "research",
        status: "done",
        observedAt: createdAt,
      },
      {
        stageId: "trade_decision",
        label: "trade",
        status: "done",
        observedAt: createdAt,
      },
      {
        stageId: "risk_lead",
        label: "risk",
        status: "done",
        observedAt: createdAt,
      },
      {
        stageId: "record_write",
        label: "record",
        status: "done",
        observedAt: createdAt,
      },
      {
        stageId: "public_timeline",
        label: "public",
        status: "done",
        observedAt: createdAt,
      },
    ],
    sourceThreadId: null,
    tradeDecision:
      tradeDirection === null
        ? null
        : {
            id: `trade:BTC:${index}`,
            schemaVersion: 1,
            symbol: "BTC",
            generatedBy: "pm",
            generatedAt: createdAt,
            direction: tradeDirection,
            entryType: tradeDirection === "wait" ? "wait" : "market",
            entryPrice: tradeDirection === "wait" ? null : 76000,
            entryRange: null,
            stopLoss: tradeDirection === "wait" ? null : 77000,
            takeProfit: tradeDirection === "wait" ? [] : [74000],
            positionSizing: tradeDirection === "wait" ? 0 : 0.25,
            timeHorizon: "intraday",
            rating: 4,
            confidence: 0.7,
            evidenceIds: [`ev_${index}`],
            riskNote: "Invalid above stop.",
            invalidatesIf: "BTC reclaims resistance.",
            promptVersion: "simple-pipeline:v1",
            modelProvider: "simple-pipeline",
            severity: "medium",
            ...tradePatch,
          },
    createdAt,
    evaluationWindowEndsAt: null,
    resolvedAt: resolvedAtValue,
    resolvedOutcome: resolvedAtValue ? "expired" : null,
    promptVersion: "simple-pipeline:v1",
    modelProvider: "simple-pipeline",
    legacyFactionId: null,
  };
}

async function addRawIndexedEntry(
  client: ReturnType<typeof __publicCardIndexTestUtils.createMemoryClient>,
  record: StrategyDecisionRecord,
  decisionDir: "long" | "short" | "neutral" | "wait" | null,
) {
  await client.zadd(publicCardIndexKey(record.locale), {
    score: Date.parse(record.createdAt),
    member: JSON.stringify({
      id: `pm-decision:${record.id}`,
      symbol: record.symbol,
      decisionDir,
      newsHeadline: null,
      createdAt: record.createdAt,
      recordKey: `claw42:strategy:record-by-id:v1:zh_CN:${encodeURIComponent(record.id)}`,
      evidenceId: record.analystInputs[0]?.evidenceIds[0] ?? null,
    }),
  });
}

function createFailureLogClient() {
  const store = new Map<string, string[]>();
  return {
    store,
    async lpush(key: string, value: string) {
      store.set(key, [value, ...(store.get(key) ?? [])]);
      return store.get(key)?.length ?? 0;
    },
    async ltrim(key: string, start: number, stop: number) {
      store.set(key, (store.get(key) ?? []).slice(start, stop + 1));
      return "OK";
    },
    async lrange(key: string, start: number, stop: number) {
      return (store.get(key) ?? []).slice(start, stop + 1);
    },
  };
}
