import { NextResponse } from "next/server";
import { PUBLIC_CARD_PAGE_SIZE, getPublicCardIndexStats } from "@/lib/watch/publicCardIndex";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_CARD_COMMANDS_PER_PAGE_ESTIMATE = 34;
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
  const estimatedMonthlyCommandsAtOneFullBrowsePerDay =
    pagesInIndex * PUBLIC_CARD_COMMANDS_PER_PAGE_ESTIMATE * 30;
  const warning =
    estimatedMonthlyCommandsAtOneFullBrowsePerDay > PUBLIC_CARD_MONTHLY_COMMAND_WARNING;

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
        estimatedCommandsPerPage: PUBLIC_CARD_COMMANDS_PER_PAGE_ESTIMATE,
        pagesInIndex,
        estimatedMonthlyCommandsAtOneFullBrowsePerDay,
        warningThreshold: PUBLIC_CARD_MONTHLY_COMMAND_WARNING,
        warning,
      },
      servedAt: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
