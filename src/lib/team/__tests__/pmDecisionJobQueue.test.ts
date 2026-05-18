import { describe, expect, it, vi } from "vitest";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import {
  PM_DECISION_QUEUE_RETENTION_SECONDS,
  PM_DECISION_QUEUE_TOPIC,
  processPmDecisionQueueMessage,
  publishPmDecisionJobToQueue,
  resolvePmDecisionQueueRetry,
  PmDecisionQueueRetryNotDueError,
} from "@/lib/team/pmDecisionJobQueue";

function job(overrides: Partial<PmDecisionJobRecord> = {}): PmDecisionJobRecord {
  return {
    id: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
    schemaVersion: 1,
    kind: "once",
    status: "queued",
    triggerSource: "user_visit_trigger",
    locale: "zh_CN",
    idempotencyKey: "once:user_visit_trigger:zh_CN:BTC:5934384",
    candidate: null,
    symbol: "BTC",
    createdAt: "2026-05-17T10:00:00.000Z",
    updatedAt: "2026-05-17T10:00:00.000Z",
    startedAt: null,
    completedAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    nextRunAt: "2026-05-17T10:00:00.000Z",
    lastError: null,
    outputCount: 0,
    decisionRecordIds: [],
    auditEventCount: 0,
    ...overrides,
  };
}

describe("pmDecisionJobQueue", () => {
  it("publishes a durable queue message with deployment-safe idempotency", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ messageId: "msg_123" });
    const result = await publishPmDecisionJobToQueue(job(), {
      now: Date.UTC(2026, 4, 17, 10, 1, 0),
      env: { PM_DECISION_QUEUE_ENABLED: "true" },
      sendMessage,
    });

    expect(result).toEqual({ mode: "queue", messageId: "msg_123" });
    expect(sendMessage).toHaveBeenCalledWith(
      PM_DECISION_QUEUE_TOPIC,
      {
        schemaVersion: 1,
        jobId: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
        queuedAt: "2026-05-17T10:01:00.000Z",
        kind: "once",
        triggerSource: "user_visit_trigger",
        locale: "zh_CN",
      },
      {
        idempotencyKey: "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
        retentionSeconds: PM_DECISION_QUEUE_RETENTION_SECONDS,
        headers: {
          "x-claw42-job-id": "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
          "x-claw42-trigger-source": "user_visit_trigger",
        },
      },
    );
  });

  it("stays disabled outside Vercel unless explicitly enabled", async () => {
    const sendMessage = vi.fn();
    const result = await publishPmDecisionJobToQueue(job(), {
      env: {},
      sendMessage,
    });

    expect(result).toEqual({ mode: "disabled" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("stays disabled on Vercel unless the queue feature flag is explicitly enabled", async () => {
    const sendMessage = vi.fn();
    const result = await publishPmDecisionJobToQueue(job(), {
      env: { VERCEL: "1", VERCEL_ENV: "preview" },
      sendMessage,
    });

    expect(result).toEqual({ mode: "disabled" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("falls back cleanly when the queue service rejects a message", async () => {
    const result = await publishPmDecisionJobToQueue(job(), {
      env: { PM_DECISION_QUEUE_ENABLED: "true" },
      sendMessage: vi.fn().mockRejectedValue(new Error("queue offline")),
    });

    expect(result).toEqual({ mode: "failed", errorMessage: "queue offline" });
  });

  it("processes queued job messages idempotently", async () => {
    const queuedJob = job();
    const readJob = vi.fn().mockResolvedValue(queuedJob);
    const runJob = vi.fn().mockResolvedValue({ job: queuedJob, outputs: [], auditEvents: [] });
    const loadContext = vi.fn().mockResolvedValue({});

    await processPmDecisionQueueMessage(
      { schemaVersion: 1, jobId: queuedJob.id, queuedAt: queuedJob.createdAt },
      { readJob, runJob, loadContext },
    );

    expect(readJob).toHaveBeenCalledWith(queuedJob.id);
    expect(loadContext).toHaveBeenCalledWith(queuedJob);
    expect(runJob).toHaveBeenCalledWith(
      queuedJob,
      expect.objectContaining({ now: expect.any(Number) }),
    );
  });

  it("acknowledges already succeeded queued jobs without running them again", async () => {
    const succeededJob = job({ status: "succeeded" });
    const runJob = vi.fn();

    await processPmDecisionQueueMessage(
      { schemaVersion: 1, jobId: succeededJob.id, queuedAt: succeededJob.createdAt },
      { readJob: vi.fn().mockResolvedValue(succeededJob), runJob },
    );

    expect(runJob).not.toHaveBeenCalled();
  });

  it("acknowledges exhausted failed jobs without running them again", async () => {
    const exhaustedJob = job({
      status: "failed",
      attemptCount: 3,
      maxAttempts: 3,
      nextRunAt: null,
      lastError: "provider timeout",
    });
    const runJob = vi.fn();
    const loadContext = vi.fn();

    await processPmDecisionQueueMessage(
      { schemaVersion: 1, jobId: exhaustedJob.id, queuedAt: exhaustedJob.createdAt },
      { readJob: vi.fn().mockResolvedValue(exhaustedJob), runJob, loadContext },
    );

    expect(loadContext).not.toHaveBeenCalled();
    expect(runJob).not.toHaveBeenCalled();
  });

  it("defers failed jobs until the ledger retry time is due", async () => {
    const retryAt = "2026-05-17T10:10:00.000Z";
    const waitingJob = job({
      status: "failed",
      attemptCount: 1,
      maxAttempts: 3,
      nextRunAt: retryAt,
      lastError: "provider timeout",
    });
    const runJob = vi.fn();

    await expect(
      processPmDecisionQueueMessage(
        { schemaVersion: 1, jobId: waitingJob.id, queuedAt: waitingJob.createdAt },
        {
          readJob: vi.fn().mockResolvedValue(waitingJob),
          runJob,
          now: Date.parse("2026-05-17T10:05:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(PmDecisionQueueRetryNotDueError);

    expect(runJob).not.toHaveBeenCalled();
  });

  it("uses the ledger retry time when scheduling a queue retry", () => {
    const retry = resolvePmDecisionQueueRetry(
      new PmDecisionQueueRetryNotDueError(
        "pm-job:once:user_visit_trigger:zh_CN:BTC:5934384",
        "2026-05-17T10:10:00.000Z",
      ),
      { deliveryCount: 1 },
      Date.parse("2026-05-17T10:05:30.000Z"),
    );

    expect(retry).toEqual({ afterSeconds: 270 });
  });

  it("acknowledges queue messages after the delivery cap is reached", () => {
    const retry = resolvePmDecisionQueueRetry(new Error("still failing"), { deliveryCount: 5 });

    expect(retry).toEqual({ acknowledge: true });
  });

  it("defers duplicate delivery while a job is still actively running", async () => {
    const runningJob = job({
      status: "running",
      startedAt: "2026-05-17T10:00:00.000Z",
      attemptCount: 1,
      nextRunAt: null,
    });
    const runJob = vi.fn();

    await expect(
      processPmDecisionQueueMessage(
        { schemaVersion: 1, jobId: runningJob.id, queuedAt: runningJob.createdAt },
        {
          readJob: vi.fn().mockResolvedValue(runningJob),
          runJob,
          now: Date.parse("2026-05-17T10:10:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(PmDecisionQueueRetryNotDueError);

    expect(runJob).not.toHaveBeenCalled();
  });

  it("allows stale running jobs to be recovered by queue retry", async () => {
    const staleRunningJob = job({
      status: "running",
      startedAt: "2026-05-17T09:00:00.000Z",
      attemptCount: 1,
      nextRunAt: null,
    });
    const runJob = vi
      .fn()
      .mockResolvedValue({ job: staleRunningJob, outputs: [], auditEvents: [] });
    const loadContext = vi.fn().mockResolvedValue({});

    await processPmDecisionQueueMessage(
      { schemaVersion: 1, jobId: staleRunningJob.id, queuedAt: staleRunningJob.createdAt },
      {
        readJob: vi.fn().mockResolvedValue(staleRunningJob),
        runJob,
        loadContext,
        now: Date.parse("2026-05-17T10:00:00.000Z"),
      },
    );

    expect(runJob).toHaveBeenCalledWith(
      staleRunningJob,
      expect.objectContaining({ partialStageUpdates: true }),
    );
  });
});
