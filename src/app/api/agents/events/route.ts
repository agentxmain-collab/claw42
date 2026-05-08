import { NextResponse } from "next/server";
import { triggerSignalGeneration } from "@/lib/marketSignals";
import { getRecentSignals } from "@/lib/signalBuffer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
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
