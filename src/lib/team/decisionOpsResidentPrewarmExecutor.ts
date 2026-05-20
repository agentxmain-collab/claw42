import type { Locale } from "@/i18n/types";
import type {
  DecisionOpsGlobalPrewarmPlanReport,
  DecisionOpsGlobalPrewarmTarget,
} from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import {
  publishPmDecisionJobToQueue,
  type PmDecisionQueuePublishResult,
} from "@/lib/team/pmDecisionJobQueue";
import { enqueuePmDecisionJob, type PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";

export const RESIDENT_PREWARM_EXECUTOR_CONFIRMATION = "enqueue-resident-prewarm";

export type DecisionOpsResidentPrewarmExecutorMode = "dry_run" | "execute";

export type DecisionOpsResidentPrewarmExecutorStatus =
  | "dry_run_ready"
  | "ready_to_execute"
  | "executed"
  | "no_targets"
  | "blocked"
  | "execution_disabled"
  | "confirmation_missing"
  | "queue_publish_disabled"
  | "partial_failed";

export interface DecisionOpsResidentPrewarmExecutorTarget {
  kind: DecisionOpsGlobalPrewarmTarget["kind"];
  priority: DecisionOpsGlobalPrewarmTarget["priority"];
  reason: DecisionOpsGlobalPrewarmTarget["reason"];
  candidate: DecisionOpsGlobalPrewarmTarget["candidate"];
  existingJobId: string | null;
  lastSucceededAt: string | null;
}

export interface DecisionOpsResidentPrewarmExecutorPlan {
  schemaVersion: 1;
  generatedAt: string;
  mode: DecisionOpsResidentPrewarmExecutorMode;
  status: DecisionOpsResidentPrewarmExecutorStatus;
  clock: "UTC";
  locale: Locale;
  executionAllowed: boolean;
  productionReleaseAllowed: false;
  publicBehaviorChanged: false;
  willRunPmPipeline: false;
  willPublishQueue: boolean;
  queuePublish: {
    requested: boolean;
    enabled: boolean;
    queueReady: boolean;
  };
  sourceStatus: DecisionOpsGlobalPrewarmPlanReport["status"];
  summary: {
    targetCount: number;
    marketOverviewTargets: number;
    hotspotTargets: number;
  };
  targets: DecisionOpsResidentPrewarmExecutorTarget[];
  blockingReasons: string[];
  enqueuedJobs: DecisionOpsResidentPrewarmEnqueuedJob[];
}

export interface DecisionOpsResidentPrewarmEnqueuedJob {
  jobId: string;
  kind: DecisionOpsResidentPrewarmExecutorTarget["kind"];
  candidateKey: string;
  status: PmDecisionJobRecord["status"];
  queuePublishResult?: PmDecisionQueuePublishResult;
}

export function buildDecisionOpsResidentPrewarmExecutorPlan({
  globalPrewarmPlan,
  mode,
  executorEnabled,
  confirmed,
  queuePublishRequested,
  queuePublishEnabled,
  queueReady,
  locale,
  now = Date.now(),
}: {
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
  mode: DecisionOpsResidentPrewarmExecutorMode;
  executorEnabled: boolean;
  confirmed: boolean;
  queuePublishRequested: boolean;
  queuePublishEnabled: boolean;
  queueReady: boolean;
  locale: Locale;
  now?: number;
}): DecisionOpsResidentPrewarmExecutorPlan {
  const targets = globalPrewarmPlan.targets
    .filter((target) => target.shouldEnqueue)
    .map(toExecutorTarget);
  const blockingReasons = blockingReasonsFor({
    globalPrewarmPlan,
    targets,
    mode,
    executorEnabled,
    confirmed,
    queuePublishRequested,
    queuePublishEnabled,
    queueReady,
  });
  const status = statusFor({
    globalPrewarmPlan,
    targets,
    mode,
    executorEnabled,
    confirmed,
    queuePublishRequested,
    queuePublishEnabled,
    queueReady,
    blockingReasons,
  });
  const willPublishQueue =
    status === "ready_to_execute" && queuePublishRequested && queuePublishEnabled && queueReady;

  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    mode,
    status,
    clock: "UTC",
    locale,
    executionAllowed: status === "ready_to_execute",
    productionReleaseAllowed: false,
    publicBehaviorChanged: false,
    willRunPmPipeline: false,
    willPublishQueue,
    queuePublish: {
      requested: queuePublishRequested,
      enabled: queuePublishEnabled,
      queueReady,
    },
    sourceStatus: globalPrewarmPlan.status,
    summary: {
      targetCount: targets.length,
      marketOverviewTargets: targets.filter((target) => target.kind === "market_overview").length,
      hotspotTargets: targets.filter((target) => target.kind === "hotspot").length,
    },
    targets,
    blockingReasons,
    enqueuedJobs: [],
  };
}

export async function executeDecisionOpsResidentPrewarmPlan({
  plan,
  enqueueJob = enqueuePmDecisionJob,
  publishJobToQueue = publishPmDecisionJobToQueue,
  now = Date.now(),
}: {
  plan: DecisionOpsResidentPrewarmExecutorPlan;
  enqueueJob?: typeof enqueuePmDecisionJob;
  publishJobToQueue?: typeof publishPmDecisionJobToQueue;
  now?: number;
}): Promise<DecisionOpsResidentPrewarmExecutorPlan> {
  if (plan.status !== "ready_to_execute") {
    throw new Error(`resident_prewarm_plan_not_executable:${plan.status}`);
  }

  const enqueuedJobs: DecisionOpsResidentPrewarmEnqueuedJob[] = [];
  for (const target of plan.targets) {
    const job = await enqueueJob({
      kind: "once",
      triggerSource: "cron",
      locale: plan.locale,
      candidate: target.candidate,
      now,
    });
    const queuePublishResult = plan.willPublishQueue
      ? await publishJobToQueue(job, { now })
      : undefined;
    enqueuedJobs.push({
      jobId: job.id,
      kind: target.kind,
      candidateKey: target.candidate.candidateKey,
      status: job.status,
      ...(queuePublishResult ? { queuePublishResult } : {}),
    });
  }

  return {
    ...plan,
    generatedAt: new Date(now).toISOString(),
    status:
      enqueuedJobs.length === plan.targets.length &&
      enqueuedJobs.every(
        (job) =>
          job.status !== "failed" &&
          (!plan.willPublishQueue || job.queuePublishResult?.mode === "queue"),
      )
        ? "executed"
        : "partial_failed",
    executionAllowed: false,
    enqueuedJobs,
  };
}

function toExecutorTarget(
  target: DecisionOpsGlobalPrewarmTarget,
): DecisionOpsResidentPrewarmExecutorTarget {
  return {
    kind: target.kind,
    priority: target.priority,
    reason: target.reason,
    candidate: target.candidate,
    existingJobId: target.existingJobId,
    lastSucceededAt: target.lastSucceededAt,
  };
}

function blockingReasonsFor({
  globalPrewarmPlan,
  targets,
  mode,
  executorEnabled,
  confirmed,
  queuePublishRequested,
  queuePublishEnabled,
  queueReady,
}: {
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
  targets: readonly DecisionOpsResidentPrewarmExecutorTarget[];
  mode: DecisionOpsResidentPrewarmExecutorMode;
  executorEnabled: boolean;
  confirmed: boolean;
  queuePublishRequested: boolean;
  queuePublishEnabled: boolean;
  queueReady: boolean;
}) {
  const reasons: string[] = [];
  if (globalPrewarmPlan.status === "blocked_by_queue") {
    reasons.push(...globalPrewarmPlan.blockingReasons, "resident_prewarm_queue_blocked");
  }
  if (!globalPrewarmPlan.safeToEnqueueResidentPrewarm || targets.length === 0) {
    reasons.push("resident_prewarm_no_targets");
  }
  if (mode === "execute" && !executorEnabled) {
    reasons.push("resident_prewarm_executor_disabled");
  }
  if (mode === "execute" && !confirmed) {
    reasons.push("resident_prewarm_confirmation_missing");
  }
  if (mode === "execute" && queuePublishRequested && !queuePublishEnabled) {
    reasons.push("resident_prewarm_queue_publish_disabled");
  }
  if (mode === "execute" && queuePublishRequested && !queueReady) {
    reasons.push("resident_prewarm_queue_not_ready");
  }
  return Array.from(new Set(reasons));
}

function statusFor({
  globalPrewarmPlan,
  targets,
  mode,
  executorEnabled,
  confirmed,
  queuePublishRequested,
  queuePublishEnabled,
  queueReady,
  blockingReasons,
}: {
  globalPrewarmPlan: DecisionOpsGlobalPrewarmPlanReport;
  targets: readonly DecisionOpsResidentPrewarmExecutorTarget[];
  mode: DecisionOpsResidentPrewarmExecutorMode;
  executorEnabled: boolean;
  confirmed: boolean;
  queuePublishRequested: boolean;
  queuePublishEnabled: boolean;
  queueReady: boolean;
  blockingReasons: readonly string[];
}): DecisionOpsResidentPrewarmExecutorStatus {
  if (globalPrewarmPlan.status === "blocked_by_queue") return "blocked";
  if (!globalPrewarmPlan.safeToEnqueueResidentPrewarm || targets.length === 0) return "no_targets";
  if (mode === "dry_run") return "dry_run_ready";
  if (!executorEnabled) return "execution_disabled";
  if (!confirmed) return "confirmation_missing";
  if (queuePublishRequested && (!queuePublishEnabled || !queueReady)) {
    return "queue_publish_disabled";
  }
  return blockingReasons.length > 0 ? "blocked" : "ready_to_execute";
}
