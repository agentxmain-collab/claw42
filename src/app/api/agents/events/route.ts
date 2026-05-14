import { NextResponse } from "next/server";
import { triggerSignalGeneration } from "@/lib/marketSignals";
import { getRecentSignals } from "@/lib/signalBuffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function canReadLegacyEvents(request: Request) {
  return process.env.NODE_ENV !== "production" && request.headers.get("x-claw42-debug") === "1";
}

export async function GET(request: Request) {
  if (!canReadLegacyEvents(request)) {
    return NextResponse.json({ error: "debug events unavailable" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 12;

  if (!Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });
  }

  await triggerSignalGeneration();
  const signals = getRecentSignals(limit);

  return NextResponse.json(
    {
      servedAt: Date.now(),
      count: signals.length,
      signals,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
