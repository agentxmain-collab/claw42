import { NextResponse, type NextRequest } from "next/server";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`watch-history:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const limitParam = url.searchParams.get("limit");
  const before = beforeParam ? Number(beforeParam) : Date.now();
  const limit = limitParam ? Math.min(Number(limitParam), 100) : 30;

  if (!Number.isFinite(before) || !Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  const result = await getWatchHistory({ before, limit });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
