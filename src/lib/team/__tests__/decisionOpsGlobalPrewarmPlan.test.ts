import { describe, expect, it } from "vitest";
import { buildDecisionOpsGlobalPrewarmPlan } from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import type { DecisionOpsQueuePriorityPolicyReport } from "@/lib/team/decisionOpsQueuePriorityPolicy";
import type { DecisionOpsResidentPublicVisibilityReport } from "@/lib/team/decisionOpsResidentPublicVisibility";
import type { ResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";

const now = Date.parse("2026-05-20T09:00:00.000Z");
const generatedAt = "2026-05-20T09:00:00.000Z";

describe("buildDecisionOpsGlobalPrewarmPlan", () => {
  it("plans UTC market overview and hotspot prewarm when global resident lanes are missing", () => {
    const report = buildDecisionOpsGlobalPrewarmPlan({
      residentStatus: residentPrewarmStatus({
        marketOverview: lane("market_overview", { state: "empty", lastSucceededAt: null }),
        hotspot: lane("hotspot", { state: "empty", lastSucceededAt: null }),
      }),
      residentVisibility: residentVisibility({
        status: "critical",
        allResidentCardsVisible: false,
        missingResidentTypes: ["market_overview", "hotspot"],
      }),
      queuePriority: queuePriority(),
      locale: "zh_CN",
      now,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt,
      status: "needs_global_prewarm",
      clock: "UTC",
      safeToEnqueueResidentPrewarm: true,
      productionReleaseAllowed: false,
      publicBehaviorChanged: false,
      summary: {
        plannedTargets: 2,
        blockedByQueue: false,
        missingVisibleResidentCards: 2,
      },
    });
    expect(report.targets.map((target) => target.candidate.candidateType)).toEqual([
      "market_overview",
      "hotspot",
    ]);
    expect(report.targets.every((target) => target.shouldEnqueue)).toBe(true);
    expect(report.targets[0].candidate.candidateKey).toBe(
      "market_overview:utc:zh_CN:2026-05-20T09",
    );
    expect(report.targets[1].candidate.candidateKey).toBe("hotspot:utc:zh_CN:2026-05-20T09:market");
  });

  it("does not enqueue duplicate resident work while resident priority is already draining", () => {
    const report = buildDecisionOpsGlobalPrewarmPlan({
      residentStatus: residentPrewarmStatus({
        marketOverview: lane("market_overview", {
          state: "queued",
          jobId: "market-job",
          candidateKey: "market_overview:utc:zh_CN:2026-05-20T09",
        }),
        hotspot: lane("hotspot", {
          state: "running",
          jobId: "hotspot-job",
          candidateKey: "hotspot:utc:zh_CN:2026-05-20T09:market",
        }),
      }),
      residentVisibility: residentVisibility({
        status: "critical",
        allResidentCardsVisible: false,
        missingResidentTypes: ["market_overview", "hotspot"],
      }),
      queuePriority: queuePriority({
        status: "prioritizing_resident",
        residentPriorityActive: true,
        priorityBands: {
          residentMarketOverview: 1,
          residentHotspot: 1,
          symbolOnce: 0,
          batch: 0,
        },
      }),
      locale: "zh_CN",
      now,
    });

    expect(report).toMatchObject({
      status: "blocked_by_queue",
      safeToEnqueueResidentPrewarm: false,
      blockingReasons: ["resident_queue_already_draining"],
      summary: {
        blockedByQueue: true,
      },
    });
    expect(report.targets).toEqual([]);
  });

  it("stays ready when both global lanes are visible and fresh", () => {
    const report = buildDecisionOpsGlobalPrewarmPlan({
      residentStatus: residentPrewarmStatus(),
      residentVisibility: residentVisibility(),
      queuePriority: queuePriority(),
      locale: "zh_CN",
      now,
    });

    expect(report).toMatchObject({
      status: "ready",
      safeToEnqueueResidentPrewarm: false,
      targets: [],
      blockingReasons: [],
      summary: {
        plannedTargets: 0,
        missingVisibleResidentCards: 0,
      },
    });
  });
});

function residentPrewarmStatus(
  overrides: Partial<ResidentPrewarmStatus> = {},
): ResidentPrewarmStatus {
  const marketOverview = lane("market_overview");
  const hotspot = lane("hotspot");
  return {
    schemaVersion: 1,
    servedAt: now,
    overallState: "ready",
    slaState: "healthy",
    latestSucceededAt: generatedAt,
    marketOverview,
    hotspot,
    ...overrides,
  };
}

function lane(
  kind: ResidentPrewarmStatus["marketOverview"]["kind"],
  overrides: Partial<ResidentPrewarmStatus["marketOverview"]> = {},
): ResidentPrewarmStatus["marketOverview"] {
  return {
    kind,
    state: "ready",
    slaState: "healthy",
    stale: false,
    ageMs: 30 * 60_000,
    expectedIntervalMs: 3 * 60 * 60_000,
    staleAfterMs: 6 * 60 * 60_000,
    lastSucceededAt: generatedAt,
    lastAttemptAt: generatedAt,
    nextRunAt: null,
    lastError: null,
    jobId: null,
    candidateKey:
      kind === "market_overview"
        ? "market_overview:utc:zh_CN:2026-05-20T09"
        : "hotspot:utc:zh_CN:2026-05-20T09:market",
    ...overrides,
  };
}

function residentVisibility(
  overrides: Partial<DecisionOpsResidentPublicVisibilityReport> = {},
): DecisionOpsResidentPublicVisibilityReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    allResidentCardsVisible: true,
    counts: { marketOverview: 1, hotspot: 1, symbol: 1 },
    missingResidentTypes: [],
    visibleResidentEventIds: { marketOverview: ["market"], hotspot: ["hotspot"] },
    blockingReasons: [],
    actions: [],
    ...overrides,
  };
}

function queuePriority(
  overrides: Partial<DecisionOpsQueuePriorityPolicyReport> = {},
): DecisionOpsQueuePriorityPolicyReport {
  return {
    schemaVersion: 1,
    generatedAt,
    status: "ready",
    residentPriorityActive: false,
    pendingOrder: [],
    blockedLowerPriorityJobs: [],
    priorityBands: {
      residentMarketOverview: 0,
      residentHotspot: 0,
      symbolOnce: 0,
      batch: 0,
    },
    nextActions: [],
    ...overrides,
  };
}
