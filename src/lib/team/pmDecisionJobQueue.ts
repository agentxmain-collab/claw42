import { send } from "@vercel/queue";
import { getCoinPool } from "@/lib/marketDataCache";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import {
  readPmDecisionJob,
  readPmDecisionJobs,
  type PmDecisionJobRecord,
} from "@/lib/watch/pmDecisionJobLedger";
import { runPmDecisionJob, type RunPmDecisionJobContext } from "@/lib/team/pmDecisionJobRunner";
import {
  findResidentPriorityBlockers,
  getPmDecisionJobQueuePriority,
  type DecisionOpsQueuePriority,
} from "@/lib/team/decisionOpsQueuePriorityPolicy";

export const PM_DECISION_QUEUE_TOPIC = "pm-decision-jobs";
export const PM_DECISION_QUEUE_RETENTION_SECONDS = 24 * 60 * 60;
export const PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS = 30 * 60;
const PM_DECISION_QUEUE_MAX_DELIVERIES = 5;
const PM_DECISION_QUEUE_MIN_RETRY_SECONDS = 30;
const PM_DECISION_QUEUE_MAX_RETRY_SECONDS = 15 * 60;

export interface PmDecisionQueueMessage {
  schemaVersion: 1;
  jobId: string;
  queuedAt: string;
  kind?: PmDecisionJobRecord["kind"];
  triggerSource?: PmDecisionJobRecord["triggerSource"];
  locale?: PmDecisionJobRecord["locale"];
  priority?: DecisionOpsQueuePriority;
}

export type PmDecisionQueuePublishResult =
  | { mode: "queue"; messageId: string | null }
  | { mode: "disabled" }
  | { mode: "failed"; errorMessage: string };

export interface PmDecisionQueueReadiness {
  schemaVersion: 1;
  enabled: boolean;
  mode: "queue" | "inline";
  topic: typeof PM_DECISION_QUEUE_TOPIC;
  retentionSeconds: typeof PM_DECISION_QUEUE_RETENTION_SECONDS;
  visibilityTimeoutSeconds: typeof PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS;
  maxDeliveries: typeof PM_DECISION_QUEUE_MAX_DELIVERIES;
  reason: "PM_DECISION_QUEUE_ENABLED=true" | "PM_DECISION_QUEUE_ENABLED is not true";
}

type SendMessage = typeof send;
type QueueRetryMetadata = { deliveryCount: number };
type QueueRetryDecision = { acknowledge: true } | { afterSeconds: number };

export class PmDecisionQueueRetryNotDueError extends Error {
  readonly jobId: string;
  readonly nextRunAt: string;

  constructor(jobId: string, nextRunAt: string) {
    super(`pm_decision_job_retry_not_due:${jobId}:${nextRunAt}`);
    this.name = "PmDecisionQueueRetryNotDueError";
    this.jobId = jobId;
    this.nextRunAt = nextRunAt;
  }
}

export class PmDecisionQueueResidentPriorityDeferError extends Error {
  readonly jobId: string;
  readonly blockingJobIds: string[];
  readonly retryAt: string;

  constructor(jobId: string, blockingJobIds: string[], retryAt: string) {
    super(`pm_decision_job_resident_priority_defer:${jobId}:${retryAt}`);
    this.name = "PmDecisionQueueResidentPriorityDeferError";
    this.jobId = jobId;
    this.blockingJobIds = blockingJobIds;
    this.retryAt = retryAt;
  }
}

export async function publishPmDecisionJobToQueue(
  job: PmDecisionJobRecord,
  {
    now = Date.now(),
    env = process.env,
    sendMessage = send,
  }: {
    now?: number;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    sendMessage?: SendMessage;
  } = {},
): Promise<PmDecisionQueuePublishResult> {
  if (!getPmDecisionQueueReadiness(env).enabled) return { mode: "disabled" };

  const priority = getPmDecisionJobQueuePriority(job);
  const message: PmDecisionQueueMessage = {
    schemaVersion: 1,
    jobId: job.id,
    queuedAt: new Date(now).toISOString(),
    kind: job.kind,
    triggerSource: job.triggerSource,
    locale: job.locale,
    priority,
  };

  try {
    const result = await sendMessage(PM_DECISION_QUEUE_TOPIC, message, {
      idempotencyKey: job.id,
      retentionSeconds: PM_DECISION_QUEUE_RETENTION_SECONDS,
      headers: {
        "x-claw42-job-id": job.id,
        "x-claw42-trigger-source": job.triggerSource,
        "x-claw42-queue-priority": String(priority.rank),
        "x-claw42-queue-priority-band": priority.band,
      },
    });
    return { mode: "queue", messageId: result.messageId };
  } catch (error) {
    return {
      mode: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getPmDecisionQueueReadiness(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): PmDecisionQueueReadiness {
  const enabled = isPmDecisionQueueEnabled(env);
  return {
    schemaVersion: 1,
    enabled,
    mode: enabled ? "queue" : "inline",
    topic: PM_DECISION_QUEUE_TOPIC,
    retentionSeconds: PM_DECISION_QUEUE_RETENTION_SECONDS,
    visibilityTimeoutSeconds: PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
    maxDeliveries: PM_DECISION_QUEUE_MAX_DELIVERIES,
    reason: enabled ? "PM_DECISION_QUEUE_ENABLED=true" : "PM_DECISION_QUEUE_ENABLED is not true",
  };
}

export async function processPmDecisionQueueMessage(
  message: PmDecisionQueueMessage,
  {
    readJob = readPmDecisionJob,
    readJobs = readPmDecisionJobs,
    runJob = runPmDecisionJob,
    loadContext = loadPmDecisionQueueRunContext,
    now = Date.now(),
  }: {
    readJob?: typeof readPmDecisionJob;
    readJobs?: typeof readPmDecisionJobs;
    runJob?: typeof runPmDecisionJob;
    loadContext?: (job: PmDecisionJobRecord) => Promise<RunPmDecisionJobContext>;
    now?: number;
  } = {},
): Promise<void> {
  if (!isPmDecisionQueueMessage(message)) {
    throw new Error("invalid_pm_decision_queue_message");
  }

  const job = await readJob(message.jobId);
  if (!job) throw new Error(`pm_decision_job_not_found:${message.jobId}`);
  if (job.status === "succeeded") return;
  if (isExhaustedFailedJob(job)) return;
  assertRunningLeaseIsStale(job, now);
  assertRetryIsDue(job, now);
  const jobs = await readJobs({ locale: job.locale, limit: 100 }).catch(() => [job]);
  const residentPriorityBlock = findResidentPriorityBlockers(job, jobs, now, {
    visibilityTimeoutSeconds: PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  });
  if (residentPriorityBlock) {
    throw new PmDecisionQueueResidentPriorityDeferError(
      job.id,
      residentPriorityBlock.blockingJobIds,
      new Date(now + residentPriorityBlock.retryAfterSeconds * 1000).toISOString(),
    );
  }

  const context = await loadContext(job);
  await runJob(job, {
    ...context,
    now,
    partialStageUpdates: true,
  });
}

export function resolvePmDecisionQueueRetry(
  error: unknown,
  metadata: QueueRetryMetadata,
  now = Date.now(),
): QueueRetryDecision {
  if (metadata.deliveryCount >= PM_DECISION_QUEUE_MAX_DELIVERIES) {
    return { acknowledge: true };
  }

  if (error instanceof PmDecisionQueueRetryNotDueError) {
    return retryAtOrDefault(error.nextRunAt, now);
  }

  if (error instanceof PmDecisionQueueResidentPriorityDeferError) {
    return retryAtOrDefault(error.retryAt, now);
  }

  return {
    afterSeconds: clampRetrySeconds(
      2 ** metadata.deliveryCount * PM_DECISION_QUEUE_MIN_RETRY_SECONDS,
    ),
  };
}

function retryAtOrDefault(retryAt: string, now: number): QueueRetryDecision {
  const retryAtMs = Date.parse(retryAt);
  if (Number.isFinite(retryAtMs) && retryAtMs > now) {
    return {
      afterSeconds: clampRetrySeconds(Math.ceil((retryAtMs - now) / 1000)),
    };
  }
  return { afterSeconds: PM_DECISION_QUEUE_MIN_RETRY_SECONDS };
}

function isPmDecisionQueueEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const configured = env.PM_DECISION_QUEUE_ENABLED?.toLowerCase();
  if (configured === "true") return true;
  return false;
}

function isPmDecisionQueueMessage(value: unknown): value is PmDecisionQueueMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
    typeof (value as { jobId?: unknown }).jobId === "string"
  );
}

function isExhaustedFailedJob(job: PmDecisionJobRecord) {
  return job.status === "failed" && job.nextRunAt === null && job.attemptCount >= job.maxAttempts;
}

function assertRetryIsDue(job: PmDecisionJobRecord, now: number) {
  if (job.status !== "failed" || !job.nextRunAt) return;
  const nextRunAtMs = Date.parse(job.nextRunAt);
  if (Number.isFinite(nextRunAtMs) && nextRunAtMs > now) {
    throw new PmDecisionQueueRetryNotDueError(job.id, job.nextRunAt);
  }
}

function assertRunningLeaseIsStale(job: PmDecisionJobRecord, now: number) {
  if (job.status !== "running" || !job.startedAt) return;
  const startedAtMs = Date.parse(job.startedAt);
  if (!Number.isFinite(startedAtMs)) return;
  const recoverAtMs = startedAtMs + PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS * 1000;
  if (recoverAtMs > now) {
    throw new PmDecisionQueueRetryNotDueError(job.id, new Date(recoverAtMs).toISOString());
  }
}

function clampRetrySeconds(value: number) {
  return Math.min(
    PM_DECISION_QUEUE_MAX_RETRY_SECONDS,
    Math.max(PM_DECISION_QUEUE_MIN_RETRY_SECONDS, value),
  );
}

async function loadPmDecisionQueueRunContext(): Promise<RunPmDecisionJobContext> {
  const [pool, news] = await Promise.all([
    getCoinPool(),
    fetchNewsWithChain({ limit: 8 }).catch(() => ({
      items: [],
      servedBy: "mock" as const,
      fellBackFrom: [],
    })),
  ]);
  const newsItems = await Promise.all(
    news.items.map((item) => normalizeNewsItem(item, news.servedBy).catch(() => item)),
  );
  return { pool, newsItems };
}
