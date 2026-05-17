import { send } from "@vercel/queue";
import { getCoinPool } from "@/lib/marketDataCache";
import { normalizeNewsItem } from "@/lib/news/normalizer";
import { fetchNewsWithChain } from "@/lib/news/sourceChain";
import { readPmDecisionJob, type PmDecisionJobRecord } from "@/lib/watch/pmDecisionJobLedger";
import { runPmDecisionJob, type RunPmDecisionJobContext } from "@/lib/team/pmDecisionJobRunner";

export const PM_DECISION_QUEUE_TOPIC = "pm-decision-jobs";
export const PM_DECISION_QUEUE_RETENTION_SECONDS = 24 * 60 * 60;
export const PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS = 30 * 60;

export interface PmDecisionQueueMessage {
  schemaVersion: 1;
  jobId: string;
  queuedAt: string;
  kind?: PmDecisionJobRecord["kind"];
  triggerSource?: PmDecisionJobRecord["triggerSource"];
  locale?: PmDecisionJobRecord["locale"];
}

export type PmDecisionQueuePublishResult =
  | { mode: "queue"; messageId: string | null }
  | { mode: "disabled" }
  | { mode: "failed"; errorMessage: string };

type SendMessage = typeof send;

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
  if (!isPmDecisionQueueEnabled(env)) return { mode: "disabled" };

  const message: PmDecisionQueueMessage = {
    schemaVersion: 1,
    jobId: job.id,
    queuedAt: new Date(now).toISOString(),
    kind: job.kind,
    triggerSource: job.triggerSource,
    locale: job.locale,
  };

  try {
    const result = await sendMessage(PM_DECISION_QUEUE_TOPIC, message, {
      idempotencyKey: job.id,
      retentionSeconds: PM_DECISION_QUEUE_RETENTION_SECONDS,
      headers: {
        "x-claw42-job-id": job.id,
        "x-claw42-trigger-source": job.triggerSource,
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

export async function processPmDecisionQueueMessage(
  message: PmDecisionQueueMessage,
  {
    readJob = readPmDecisionJob,
    runJob = runPmDecisionJob,
    loadContext = loadPmDecisionQueueRunContext,
    now = Date.now(),
  }: {
    readJob?: typeof readPmDecisionJob;
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

  const context = await loadContext(job);
  await runJob(job, {
    ...context,
    now,
    partialStageUpdates: true,
  });
}

function isPmDecisionQueueEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  const configured = env.PM_DECISION_QUEUE_ENABLED?.toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return env.VERCEL === "1" && Boolean(env.VERCEL_ENV);
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
