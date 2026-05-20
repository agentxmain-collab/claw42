import { NextResponse } from "next/server";
import {
  buildDecisionOpsResidentPrewarmExecutorPlan,
  executeDecisionOpsResidentPrewarmPlan,
  RESIDENT_PREWARM_EXECUTOR_CONFIRMATION,
  type DecisionOpsResidentPrewarmExecutorMode,
} from "@/lib/team/decisionOpsResidentPrewarmExecutor";
import { buildDecisionOpsGlobalPrewarmPlan } from "@/lib/team/decisionOpsGlobalPrewarmPlan";
import { buildDecisionOpsQueuePriorityPolicy } from "@/lib/team/decisionOpsQueuePriorityPolicy";
import { buildDecisionOpsResidentPublicVisibility } from "@/lib/team/decisionOpsResidentPublicVisibility";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import {
  getPmDecisionQueueReadiness,
  publishPmDecisionJobToQueue,
} from "@/lib/team/pmDecisionJobQueue";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import { enqueuePmDecisionJob, readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";
import { deriveResidentPrewarmStatus } from "@/lib/watch/residentPrewarmStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LEDGER_LIMIT = 500;

export async function GET(request: Request) {
  return handle(request, "dry_run");
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const mode = normalizeMode(url.searchParams.get("mode"));
  return handle(request, mode);
}

async function handle(request: Request, mode: DecisionOpsResidentPrewarmExecutorMode) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const now = requestNow(url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const confirmed =
    request.headers.get("x-claw42-resident-prewarm-confirm") ===
    RESIDENT_PREWARM_EXECUTOR_CONFIRMATION;
  const executorEnabled =
    process.env.OPS_RESIDENT_PREWARM_EXECUTOR_ENABLED?.toLowerCase() === "true";
  const queuePublishRequested = url.searchParams.get("publishQueue") === "true";
  const queuePublishEnabled =
    process.env.OPS_RESIDENT_PREWARM_QUEUE_PUBLISH_ENABLED?.toLowerCase() === "true";
  const queueReadiness = getPmDecisionQueueReadiness();
  const [jobs, records] = await Promise.all([
    readPmDecisionJobs({ locale, limit: LEDGER_LIMIT }),
    readAllDecisionRecords(LEDGER_LIMIT, locale),
  ]);
  const publicEvents = publicPmEventsFromRecords(records);
  const queuePriority = buildDecisionOpsQueuePriorityPolicy({
    jobs,
    now,
  });
  const residentStatus = deriveResidentPrewarmStatus({
    records,
    jobs,
    now,
  });
  const residentVisibility = buildDecisionOpsResidentPublicVisibility({
    publicEvents,
    now,
  });
  const globalPrewarmPlan = buildDecisionOpsGlobalPrewarmPlan({
    residentStatus,
    residentVisibility,
    queuePriority,
    locale,
    now,
  });
  const plan = buildDecisionOpsResidentPrewarmExecutorPlan({
    globalPrewarmPlan,
    mode,
    executorEnabled,
    confirmed,
    queuePublishRequested,
    queuePublishEnabled,
    queueReady: queueReadiness.enabled,
    locale,
    now,
  });

  if (mode !== "execute" || !plan.executionAllowed) {
    return NextResponse.json(
      {
        ok: mode !== "execute",
        locale,
        plan,
      },
      {
        status: mode === "execute" && !plan.executionAllowed ? 403 : 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const executedPlan = await executeDecisionOpsResidentPrewarmPlan({
    plan,
    enqueueJob: enqueuePmDecisionJob,
    publishJobToQueue: publishPmDecisionJobToQueue,
    now,
  });

  return NextResponse.json(
    {
      ok: executedPlan.status === "executed",
      locale,
      plan: executedPlan,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function publicPmEventsFromRecords(records: readonly StrategyDecisionRecord[]) {
  return records
    .map((record) => projectDecisionRecordToPublicEvent(record))
    .filter((event): event is PublicTimelineEvent => event?.payload.kind === "pm_decision");
}

function normalizeMode(value: string | null): DecisionOpsResidentPrewarmExecutorMode {
  return value === "execute" ? "execute" : "dry_run";
}

function requestNow(url: URL) {
  const raw = url.searchParams.get("testNow") ?? url.searchParams.get("now");
  if (!raw) return Date.now();
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  const parsedDate = Date.parse(raw);
  return Number.isFinite(parsedDate) ? parsedDate : Date.now();
}

function isAuthorized(request: Request) {
  const secret = process.env.OPS_HEALTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-claw42-ops-secret") === secret;
}
