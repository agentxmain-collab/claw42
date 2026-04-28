import { NextResponse } from "next/server";
import { getHistoryMessages, getNewestGeneratedAt } from "@/lib/llmFallbackChain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 60;

  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });
  }

  const entries = getHistoryMessages(limit);
  const newestGeneratedAt = getNewestGeneratedAt();
  const cacheControl =
    entries.length === 0 ? "no-store" : "public, s-maxage=10, stale-while-revalidate=20";

  return NextResponse.json(
    {
      servedAt: Date.now(),
      count: entries.length,
      newestGeneratedAt,
      entries,
    },
    {
      headers: { "Cache-Control": cacheControl },
    },
  );
}
