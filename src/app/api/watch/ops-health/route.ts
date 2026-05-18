import { NextResponse } from "next/server";
import { readDecisionRuns } from "@/lib/team/decisionRunLedger";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { buildDecisionOpsDeepDiagnostics } from "@/lib/team/decisionOpsDeepDiagnostics";
import {
  buildDecisionOpsHealthDetails,
  summarizeDecisionOpsHealth,
} from "@/lib/team/decisionOpsHealth";
import { buildDecisionOpsReconciliation } from "@/lib/team/decisionOpsReconciliation";
import { getPmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import { summarizeProviderTelemetry } from "@/lib/team/providerTelemetry";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { projectDecisionRecordToPublicEvent } from "@/lib/watch/publicTimelineProjection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const includeDetails = url.searchParams.get("details") === "1";
  const includeReconciliation = url.searchParams.get("reconcile") === "1";
  const includeDeepDiagnostics = url.searchParams.get("deep") === "1";
  const needsDecisionRecords = includeReconciliation || includeDeepDiagnostics;
  const detailLimit = normalizeDetailLimit(url.searchParams.get("detailLimit"));
  const [jobs, runs, decisionRecords] = await Promise.all([
    readPmDecisionJobs({ locale, limit }),
    readDecisionRuns({ locale, limit }),
    needsDecisionRecords ? readAllDecisionRecords(500, locale) : Promise.resolve([]),
  ]);
  const queueReadiness = getPmDecisionQueueReadiness();
  const publicEvents = includeReconciliation ? publicPmEventsFromRecords(decisionRecords) : [];

  return NextResponse.json(
    {
      ok: true,
      locale,
      health: summarizeDecisionOpsHealth({ jobs, runs }),
      queueReadiness,
      ...(includeDetails
        ? { details: buildDecisionOpsHealthDetails({ jobs, runs, limit: detailLimit }) }
        : {}),
      ...(includeReconciliation
        ? {
            reconciliation: buildDecisionOpsReconciliation({
              jobs,
              runs,
              publicEvents,
              queueReadiness,
            }),
          }
        : {}),
      ...(includeDeepDiagnostics
        ? {
            deepDiagnostics: buildDecisionOpsDeepDiagnostics({
              jobs,
              runs,
              records: decisionRecords,
              providerTelemetry: summarizeProviderTelemetry({ since: Date.now() - 24 * 60_000 }),
            }),
          }
        : {}),
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

function isAuthorized(request: Request) {
  const secret = process.env.OPS_HEALTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-claw42-ops-secret") === secret;
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function normalizeDetailLimit(value: string | null) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}
