import { NextResponse } from "next/server";
import { readDecisionRuns } from "@/lib/team/decisionRunLedger";
import {
  buildDecisionOpsHealthDetails,
  summarizeDecisionOpsHealth,
} from "@/lib/team/decisionOpsHealth";
import { getPmDecisionQueueReadiness } from "@/lib/team/pmDecisionJobQueue";
import { readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { localeFromRequestUrl } from "@/lib/watch/locale";

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
  const detailLimit = normalizeDetailLimit(url.searchParams.get("detailLimit"));
  const [jobs, runs] = await Promise.all([
    readPmDecisionJobs({ locale, limit }),
    readDecisionRuns({ locale, limit }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      locale,
      health: summarizeDecisionOpsHealth({ jobs, runs }),
      queueReadiness: getPmDecisionQueueReadiness(),
      ...(includeDetails
        ? { details: buildDecisionOpsHealthDetails({ jobs, runs, limit: detailLimit }) }
        : {}),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
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
