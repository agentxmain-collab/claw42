import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __pmDecisionJobLedgerTestUtils,
  enqueuePmDecisionJob,
  markPmDecisionJobFailed,
  markPmDecisionJobRunning,
  markPmDecisionJobSucceeded,
  readPmDecisionJobs,
} from "@/lib/watch/pmDecisionJobLedger";

let storeDir: string | null = null;

describe("pmDecisionJobLedger", () => {
  beforeEach(async () => {
    storeDir = await mkdtemp(path.join(os.tmpdir(), "claw42-pm-job-ledger-"));
    process.env.PM_DECISION_JOB_STORE_DIR = storeDir;
    delete process.env.USE_PERSISTENT_KV;
    __pmDecisionJobLedgerTestUtils.clearMemoryJobs();
  });

  afterEach(async () => {
    delete process.env.PM_DECISION_JOB_STORE_DIR;
    if (storeDir) await rm(storeDir, { recursive: true, force: true });
    storeDir = null;
    __pmDecisionJobLedgerTestUtils.clearMemoryJobs();
  });

  it("dedupes queued jobs by idempotency key and records lifecycle state", async () => {
    const now = Date.UTC(2026, 4, 17, 10, 0, 0);
    const first = await enqueuePmDecisionJob({
      kind: "once",
      triggerSource: "user_visit_trigger",
      locale: "zh_CN",
      symbol: "BTC",
      now,
    });
    const duplicate = await enqueuePmDecisionJob({
      kind: "once",
      triggerSource: "user_visit_trigger",
      locale: "zh_CN",
      symbol: "BTC",
      now: now + 30_000,
    });

    expect(duplicate.id).toBe(first.id);
    expect(duplicate.status).toBe("queued");

    const running = await markPmDecisionJobRunning(first.id, { now: now + 1_000 });
    expect(running?.status).toBe("running");
    expect(running?.attemptCount).toBe(1);

    const succeeded = await markPmDecisionJobSucceeded(first.id, {
      now: now + 2_000,
      outputCount: 1,
      decisionRecordIds: ["pm:BTC:test"],
      auditEventCount: 3,
    });
    expect(succeeded).toMatchObject({
      status: "succeeded",
      outputCount: 1,
      decisionRecordIds: ["pm:BTC:test"],
      auditEventCount: 3,
    });

    const jobs = await readPmDecisionJobs({ locale: "zh_CN" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(first.id);
  });

  it("keeps failed jobs readable with retry metadata", async () => {
    const now = Date.UTC(2026, 4, 17, 10, 0, 0);
    const job = await enqueuePmDecisionJob({
      kind: "batch",
      triggerSource: "cron",
      locale: "zh_CN",
      now,
    });

    await markPmDecisionJobRunning(job.id, { now: now + 1_000 });
    const failed = await markPmDecisionJobFailed(job.id, {
      now: now + 2_000,
      error: "provider timeout",
    });

    expect(failed).toMatchObject({
      status: "failed",
      attemptCount: 1,
      lastError: "provider timeout",
      nextRunAt: expect.any(String),
    });
  });
});
