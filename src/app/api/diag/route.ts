import { NextResponse } from "next/server";
import { getPublicCardIndexStats } from "@/lib/watch/publicCardIndex";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  return NextResponse.json(
    {
      ok: true,
      locale,
      publicCardIndex,
      servedAt: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
