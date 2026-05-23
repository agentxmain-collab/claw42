import { NextResponse } from "next/server";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { buildPublicDashboardHealth } from "@/lib/team/decisionOpsDashboardHealth";
import { readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const now = Date.now();
  const [jobs, records] = await Promise.all([
    readPmDecisionJobs({ locale, limit: 100 }),
    readAllDecisionRecords(100, locale),
  ]);

  return NextResponse.json(buildPublicDashboardHealth({ records, jobs, now }), {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60",
    },
  });
}
