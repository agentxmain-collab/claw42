import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  __decisionRecordStoreTestUtils,
  appendDecisionRecord,
  readAllDecisionRecords,
  readDecisionRecords,
} from "@/lib/team/decisionRecordStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";

let tempDir: string;

describe("decisionRecordStore", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "claw42-decision-records-"));
    process.env.DECISION_RECORD_STORE_DIR = tempDir;
    delete process.env.USE_PERSISTENT_KV;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    __decisionRecordStoreTestUtils.clearMemoryRecords();
  });

  afterEach(async () => {
    delete process.env.DECISION_RECORD_STORE_DIR;
    await rm(tempDir, { recursive: true, force: true });
    __decisionRecordStoreTestUtils.clearMemoryRecords();
  });

  test("appends and reads records for one symbol in newest-first order", async () => {
    await appendDecisionRecord(makeRecord({ id: "older", createdAt: "2026-05-10T00:00:00.000Z" }));
    await appendDecisionRecord(makeRecord({ id: "newer", createdAt: "2026-05-10T00:01:00.000Z" }));

    const records = await readDecisionRecords("btc");

    expect(records.map((record) => record.id)).toEqual(["newer", "older"]);
    expect(records.every((record) => record.symbol === "BTC")).toBe(true);
  });

  test("reads all records across symbols sorted by createdAt", async () => {
    await appendDecisionRecord(
      makeRecord({ id: "eth", symbol: "ETH", createdAt: "2026-05-10T00:00:00.000Z" }),
    );
    await appendDecisionRecord(
      makeRecord({ id: "btc", symbol: "BTC", createdAt: "2026-05-10T00:02:00.000Z" }),
    );

    const records = await readAllDecisionRecords();

    expect(records.map((record) => record.id)).toEqual(["btc", "eth"]);
  });

  test("isolates decision records by locale and defaults reads to zh_CN", async () => {
    await appendDecisionRecord(makeRecord({ id: "zh", locale: "zh_CN" }));
    await appendDecisionRecord(makeRecord({ id: "en", locale: "en_US" }));

    expect((await readDecisionRecords("BTC", 10, "zh_CN")).map((record) => record.id)).toEqual([
      "zh",
    ]);
    expect((await readDecisionRecords("BTC", 10, "en_US")).map((record) => record.id)).toEqual([
      "en",
    ]);
    expect((await readDecisionRecords("BTC")).map((record) => record.id)).toEqual(["zh"]);
  });

  test("readAllDecisionRecords keeps locale buckets isolated", async () => {
    await appendDecisionRecord(
      makeRecord({
        id: "zh-btc",
        locale: "zh_CN",
        symbol: "BTC",
        createdAt: "2026-05-10T00:03:00.000Z",
      }),
    );
    await appendDecisionRecord(
      makeRecord({
        id: "zh-eth",
        locale: "zh_CN",
        symbol: "ETH",
        createdAt: "2026-05-10T00:02:00.000Z",
      }),
    );
    await appendDecisionRecord(
      makeRecord({
        id: "en-btc",
        locale: "en_US",
        symbol: "BTC",
        createdAt: "2026-05-10T00:01:00.000Z",
      }),
    );

    expect((await readAllDecisionRecords(10, "zh_CN")).map((record) => record.id)).toEqual([
      "zh-btc",
      "zh-eth",
    ]);
    expect((await readAllDecisionRecords(10, "en_US")).map((record) => record.id)).toEqual([
      "en-btc",
    ]);
    expect((await readAllDecisionRecords()).map((record) => record.id)).toEqual([
      "zh-btc",
      "zh-eth",
    ]);
  });
});

function makeRecord(overrides: Partial<StrategyDecisionRecord> = {}): StrategyDecisionRecord {
  return {
    id: "record-1",
    schemaVersion: 1,
    recordSource: "paper",
    symbol: "BTC",
    locale: "zh_CN",
    decisionOwnerId: "pm",
    contributorIds: ["chart_analyst"],
    analystInputs: [
      {
        memberId: "chart_analyst",
        direction: "long",
        confidence: 0.7,
        rationale: "BTC reclaimed the trigger level.",
        evidenceIds: [],
      },
    ],
    sourceThreadId: "thread-1",
    tradeDecision: null,
    createdAt: "2026-05-10T00:00:00.000Z",
    evaluationWindowEndsAt: null,
    resolvedAt: null,
    resolvedOutcome: null,
    promptVersion: "test-v1",
    modelProvider: "deepseek",
    ...overrides,
  };
}
