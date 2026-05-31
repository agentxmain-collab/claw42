import { NextResponse } from "next/server";
import { readAllDecisionRecords } from "@/lib/team/decisionRecordStore";
import { buildPublicDashboardHealth } from "@/lib/team/decisionOpsDashboardHealth";
import { readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import { checkPublicBoardKvBudget } from "@/lib/watch/publicBoardKvBudgetGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Vercel-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
} as const;
const PUBLIC_ALLOWED_QUERY_KEYS = new Set(["locale"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  for (const key of Array.from(url.searchParams.keys())) {
    if (!PUBLIC_ALLOWED_QUERY_KEYS.has(key)) {
      return NextResponse.json({ error: "unsupported_query" }, { status: 400 });
    }
  }
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const now = Date.now();
  const budget = checkPublicBoardKvBudget({
    route: "dashboard-health",
    estimatedCommands: 4,
    now,
  });
  if (!budget.allowed) {
    return NextResponse.json(buildPublicDashboardHealth({ records: [], jobs: [], now }), {
      headers: PUBLIC_CACHE_HEADERS,
    });
  }
  const [jobs, records] = await Promise.all([
    readPmDecisionJobs({ locale, limit: 100 }),
    readAllDecisionRecords(100, locale),
  ]);

  return NextResponse.json(buildPublicDashboardHealth({ records, jobs, now }), {
    headers: PUBLIC_CACHE_HEADERS,
  });
}
