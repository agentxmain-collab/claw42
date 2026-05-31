import { NextResponse } from "next/server";
import { PUBLIC_CARD_PAGE_SIZE, getPublicCardIndexStats } from "@/lib/watch/publicCardIndex";
import { localeFromRequestUrl } from "@/lib/watch/locale";
import { estimatePublicBoardTrafficBudget } from "@/lib/watch/publicBoardBudget";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_CARD_MONTHLY_COMMAND_WARNING = 350_000;

function isAuthorized(request: Request) {
  const secret = process.env.OPS_HEALTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-claw42-ops-secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const locale = localeFromRequestUrl(url, request.headers.get("accept-language"));
  const publicCardIndex = await getPublicCardIndexStats(locale);
  const pagesInIndex = Math.ceil(publicCardIndex.count / PUBLIC_CARD_PAGE_SIZE);
  const testProjectedMonthlyCommands = Number(url.searchParams.get("testProjectedMonthlyCommands"));
  const cacheMissesPerMinuteParam = url.searchParams.get("cacheMissesPerMinute");
  const trafficBudget = estimatePublicBoardTrafficBudget({
    viewerCount: Number(url.searchParams.get("viewerCount") ?? 500),
    cacheMissesPerMinute: Number(cacheMissesPerMinuteParam ?? Math.max(pagesInIndex, 1)),
    snapshotWritesPerMinute: Number(url.searchParams.get("snapshotWritesPerMinute") ?? 1),
  });
  const estimatedMonthlyCommandsAtOneFullBrowsePerDay =
    trafficBudget.snapshot.kvCommandsPerMinute * 60 * 24 * 30;
  const projectedMonthlyCommands = Number.isFinite(testProjectedMonthlyCommands)
    ? testProjectedMonthlyCommands
    : estimatedMonthlyCommandsAtOneFullBrowsePerDay;
  const warning = projectedMonthlyCommands > PUBLIC_CARD_MONTHLY_COMMAND_WARNING;

  if (warning) {
    console.warn("[claw42] public-card index monthly command budget warning", {
      locale,
      estimatedMonthlyCommandsAtOneFullBrowsePerDay,
      threshold: PUBLIC_CARD_MONTHLY_COMMAND_WARNING,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      locale,
      publicCardIndex,
      budget: {
        pageSize: PUBLIC_CARD_PAGE_SIZE,
        model: "shared-public-timeline-snapshot-v1",
        pagesInIndex,
        trafficBudget,
        estimatedMonthlyCommandsAtOneFullBrowsePerDay,
        projectedMonthlyCommands,
        warningThreshold: PUBLIC_CARD_MONTHLY_COMMAND_WARNING,
        warning,
      },
      servedAt: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
