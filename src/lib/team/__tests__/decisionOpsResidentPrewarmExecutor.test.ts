import { describe, expect, it, vi } from "vitest";
import {
  buildDecisionOpsResidentPrewarmExecutorPlan,
  executeDecisionOpsResidentPrewarmPlan,
} from "@/lib/team/decisionOpsResidentPrewarmExecutor";
import type { DecisionOpsGlobalPrewarmPlanReport } from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import type { enqueuePmDecisionJob, PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

const now = Date.parse("2026-05-20T12:00:00.000Z");
const generatedAt = "2026-05-20T12:00:00.000Z";

describe("decisionOpsResidentPrewarmExecutor", () => {
  it("builds a dry-run plan without making the resident prewarm executable", () => {
    const plan = buildDecisionOpsResidentPrewarmExecutorPlan({
      globalPrewarmPlan: globalPrewarmPlan(),
      mode: "dry_run",
      executorEnabled: false,
      confirmed: false,
      locale: "zh_CN",
      now,
    });

    expect(plan).toMatchObject({
      schemaVersion: 1,
      generatedAt,
      mode: "dry_run",
      status: "dry_run_ready",
      executionAllowed: false,
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
      willRunPmPipeline: false,
      willPublishQueue: false,
      summary: {
        targetCount: 2,
        marketOverviewTargets: 1,
        hotspotTargets: 1,
      },
    });
    expect(plan.targets.map((target) => target.candidate.candidateType)).toEqual([
      "market_overview",
      "hotspot",
    ]);
  });

  it("requires both the executor env gate and explicit confirmation before enqueueing", async () => {
    const enqueueJob = vi.fn<typeof enqueuePmDecisionJob>();
    const disabledPlan = buildDecisionOpsResidentPrewarmExecutorPlan({
      globalPrewarmPlan: globalPrewarmPlan(),
      mode: "execute",
      executorEnabled: false,
      confirmed: true,
      locale: "zh_CN",
      now,
    });
    const missingConfirmPlan = buildDecisionOpsResidentPrewarmExecutorPlan({
      globalPrewarmPlan: globalPrewarmPlan(),
      mode: "execute",
      executorEnabled: true,
      confirmed: false,
      locale: "zh_CN",
      now,
    });

    expect(disabledPlan.status).toBe("execution_disabled");
    expect(missingConfirmPlan.status).toBe("confirmation_missing");
    await expect(
      executeDecisionOpsResidentPrewarmPlan({
        plan: disabledPlan,
        enqueueJob,
        now,
      }),
    ).rejects.toThrow("resident_prewarm_plan_not_executable:execution_disabled");
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues resident jobs only after explicit executor approval", async () => {
    const enqueueJob = vi.fn<typeof enqueuePmDecisionJob>(
      async (input): Promise<PmDecisionJobRecord> => ({
        id: `job:${input.candidate?.candidateKey}`,
        schemaVersion: 1 as const,
        kind: input.kind,
        status: "queued" as const,
        triggerSource: input.triggerSource,
        locale: input.locale ?? "zh_CN",
        idempotencyKey: `once:cron:${input.candidate?.candidateKey}`,
        candidate: input.candidate ?? null,
        symbol: input.symbol ?? input.candidate?.symbol ?? null,
        createdAt: generatedAt,
        updatedAt: generatedAt,
        startedAt: null,
        completedAt: null,
        attemptCount: 0,
        maxAttempts: 3,
        nextRunAt: generatedAt,
        lastError: null,
        outputCount: 0,
        decisionRecordIds: [],
        auditEventCount: 0,
      }),
    );
    const plan = buildDecisionOpsResidentPrewarmExecutorPlan({
      globalPrewarmPlan: globalPrewarmPlan(),
      mode: "execute",
      executorEnabled: true,
      confirmed: true,
      locale: "zh_CN",
      now,
    });

    const result = await executeDecisionOpsResidentPrewarmPlan({
      plan,
      enqueueJob,
      now,
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      mode: "execute",
      status: "executed",
      executionAllowed: false,
      enqueuedJobs: [
        {
          jobId: "job:market_overview:utc:zh_CN:2026-05-20T12",
          candidateKey: "market_overview:utc:zh_CN:2026-05-20T12",
        },
        {
          jobId: "job:hotspot:utc:zh_CN:2026-05-20T12:market",
          candidateKey: "hotspot:utc:zh_CN:2026-05-20T12:market",
        },
      ],
    });
    expect(enqueueJob).toHaveBeenCalledTimes(2);
    expect(enqueueJob).toHaveBeenNthCalledWith(1, {
      kind: "once",
      triggerSource: "cron",
      locale: "zh_CN",
      candidate: expect.objectContaining({
        candidateType: "market_overview",
      }),
      now,
    });
    expect(enqueueJob).toHaveBeenNthCalledWith(2, {
      kind: "once",
      triggerSource: "cron",
      locale: "zh_CN",
      candidate: expect.objectContaining({
        candidateType: "hotspot",
      }),
      now,
    });
  });
});

function globalPrewarmPlan(
  overrides: Partial<DecisionOpsGlobalPrewarmPlanReport> = {},
): DecisionOpsGlobalPrewarmPlanReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "needs_global_prewarm",
    clock: "UTC",
    safeToEnqueueResidentPrewarm: true,
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    utcPolicy: {
      marketOverviewIntervalHours: 3,
      hotspotIntervalHours: 3,
    },
    summary: {
      plannedTargets: 2,
      missingVisibleResidentCards: 2,
      blockedByQueue: false,
    },
    targets: [
      {
        kind: "market_overview",
        priority: 10,
        reason: "resident_market_overview_missing",
        shouldEnqueue: true,
        candidate: {
          candidateType: "market_overview",
          candidateKey: "market_overview:utc:zh_CN:2026-05-20T12",
          displayTitle: "今日大盘综述",
          executable: false,
          cadence: "intraday",
          score: 100,
          reasons: [],
        },
        existingJobId: null,
        lastSucceededAt: null,
      },
      {
        kind: "hotspot",
        priority: 20,
        reason: "resident_hotspot_not_visible",
        shouldEnqueue: true,
        candidate: {
          candidateType: "hotspot",
          candidateKey: "hotspot:utc:zh_CN:2026-05-20T12:market",
          displayTitle: "热点叙事追踪",
          executable: false,
          cadence: "intraday",
          score: 80,
          reasons: [],
        },
        existingJobId: null,
        lastSucceededAt: null,
      },
    ],
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}
