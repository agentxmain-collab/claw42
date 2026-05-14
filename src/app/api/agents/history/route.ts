import { NextResponse } from "next/server";
import { getHistoryMessages, getNewestGeneratedAt } from "@/lib/agentAnalysis";

export const runtime = "nodejs";

function canReadLegacyHistory(request: Request) {
  return process.env.NODE_ENV !== "production" && request.headers.get("x-claw42-debug") === "1";
}

export async function GET(request: Request) {
  if (!canReadLegacyHistory(request)) {
    return NextResponse.json({ error: "debug history unavailable" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 60;

  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });
  }

  const entries = getHistoryMessages(limit);
  const newestGeneratedAt = getNewestGeneratedAt();

  return NextResponse.json(
    {
      servedAt: Date.now(),
      count: entries.length,
      newestGeneratedAt,
      entries,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
