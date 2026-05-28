import { describe, expect, it } from "vitest";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import {
  __publicCardIndexTestUtils,
  backfillPublicCardIndexFromRecords,
  buildPublicCardIndexEntry,
  cleanupPublicCardIndex,
  PUBLIC_CARD_RETENTION_MS,
  PUBLIC_CARD_TOTAL_CAP,
  prunePublicCardIndexByDirectionalClosure,
  publicCardIndexKey,
  readPublicCardIndexPage,
  writePublicCardIndexEntry,
} from "@/lib/watch/publicCardIndex";

describe("publicCardIndex", () => {
  it("indexes only closed long or short decisions", () => {
    const now = Date.UTC(2026, 4, 28, 7, 0, 0);

    expect(buildPublicCardIndexEntry(makeRecord(1, now, { tradeDirection: "long" }))).toMatchObject(
      { decisionDir: "long" },
    );
    expect(
      buildPublicCardIndexEntry(makeRecord(2, now, { tradeDirection: "short" })),
    ).toMatchObject({ decisionDir: "short" });
    expect(buildPublicCardIndexEntry(makeRecord(3, now, { tradeDirection: "wait" }))).toBeNull();
    expect(buildPublicCardIndexEntry(makeRecord(4, now, { resolvedAt: null }))).toBeNull();
    expect(
      buildPublicCardIndexEntry(
        makeRecord(5, now, { tradeDirection: null, analystDirection: "neutral" }),
      ),
    ).toBeNull();
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

  it("prunes indexed cards without both direction and closure", async () => {
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
    const records = new Map(
      [validLong, validShort, unresolved, wait, neutral].map((record) => [
        `claw42:strategy:record-by-id:v1:zh_CN:${encodeURIComponent(record.id)}`,
        record,
      ]),
    );

    for (const record of [validLong, validShort]) {
      await writePublicCardIndexEntry(record, { client });
    }
    await addRawIndexedEntry(client, unresolved, "long");
    await addRawIndexedEntry(client, wait, "wait");
    await addRawIndexedEntry(client, neutral, null);

    const removed = await prunePublicCardIndexByDirectionalClosure("zh_CN", {
      client,
      readRecord: async (entry) => records.get(entry.recordKey) ?? null,
    });
    const page = await readPublicCardIndexPage("zh_CN", { page: 1, pageSize: 10, client });

    expect(removed).toBe(3);
    expect(page.totalCount).toBe(2);
    expect(page.entries.map((entry) => entry.decisionDir).sort()).toEqual(["long", "short"]);
  });
});

type MakeRecordOptions = {
  tradeDirection?: "long" | "short" | "wait" | null;
  analystDirection?: "long" | "short" | "neutral" | "wait";
  resolvedAt?: string | null;
};

function makeRecord(
  index: number,
  createdAtMs: number,
  { tradeDirection = "short", analystDirection = "short", resolvedAt }: MakeRecordOptions = {},
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
