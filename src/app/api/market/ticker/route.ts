import { NextResponse, type NextRequest } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";
import { triggerSignalGeneration } from "@/lib/marketSignals";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`ticker:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const payload = (await triggerSignalGeneration()) ?? (await getCoinPool());
  const status = payload.error && !payload.isStale && !payload.isFallback ? 503 : 200;
  return NextResponse.json(payload, { status });
}
