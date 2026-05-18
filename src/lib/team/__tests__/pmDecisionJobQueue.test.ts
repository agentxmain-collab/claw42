import { describe, expect, it, vi } from "vitest";
import type { PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import {
  PM_DECISION_QUEUE_RETENTION_SECONDS,
  PM_DECISION_QUEUE_TOPIC,
  processPmDecisionQueueMessage,
  publishPmDecisionJobToQueue,
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
});
