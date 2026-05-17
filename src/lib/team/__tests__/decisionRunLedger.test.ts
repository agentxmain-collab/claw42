import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __decisionRunLedgerTestUtils,
  readDecisionRuns,
  upsertDecisionRun,
  type DecisionRunRecord,
} from "@/lib/team/decisionRunLedger";

let storeDir: string | null = null;

function run(overrides: Partial<DecisionRunRecord> = {}): DecisionRunRecord {
  return {
    id: "run:pm:BTC:1778407200000",
    schemaVersion: 1,
    status: "running",
    triggerSource: "cron",
    locale: "zh_CN",
    candidate: {
      candidateType: "symbol",
      candidateKey: "symbol:BTC",
      displayTitle: "BTC 实时行情分析",
      executable: true,
      symbol: "BTC",
    },
    symbol: "BTC",
    startedAt: "2026-05-10T10:00:00.000Z",
    completedAt: null,
    stageStatus: {
      analyst_inputs: "in_progress",
    },
    analystRoundCount: 0,
    activeMemberIds: [],
    abstainedMemberIds: [],
    decisionRecordId: null,
    publicTimelineEventId: null,
    error: null,
    skipReason: null,
    ...overrides,
  };
}

describe("decisionRunLedger", () => {
  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "claw42-run-ledger-"));
    process.env.DECISION_RUN_STORE_DIR = storeDir;
    delete process.env.USE_PERSISTENT_KV;
    __decisionRunLedgerTestUtils.clearMemoryRuns();
  });

  afterEach(async () => {
    delete process.env.DECISION_RUN_STORE_DIR;
    if (storeDir) await rm(storeDir, { recursive: true, force: true });
    storeDir = null;
    __decisionRunLedgerTestUtils.clearMemoryRuns();
  });

  it("upserts private run state and reads latest first", async () => {
    await upsertDecisionRun(run());
    await upsertDecisionRun(
      run({
        status: "succeeded",
        completedAt: "2026-05-10T10:01:00.000Z",
        stageStatus: {
          analyst_inputs: "done",
          research_lead: "done",
          risk_lead: "done",
          trade_decision: "done",
          record_write: "done",
          public_timeline: "done",
        },
        analystRoundCount: 22,
        activeMemberIds: ["chart_analyst"],
        decisionRecordId: "pm:BTC:1778407200000",
        publicTimelineEventId: "public:pm:BTC:1778407200000",
      }),
    );

    const runs = await readDecisionRuns({ locale: "zh_CN" });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: "run:pm:BTC:1778407200000",
      status: "succeeded",
      analystRoundCount: 22,
      decisionRecordId: "pm:BTC:1778407200000",
      publicTimelineEventId: "public:pm:BTC:1778407200000",
    });
  });
});
