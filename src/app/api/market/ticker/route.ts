import { NextResponse } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";
import { triggerSignalGeneration } from "@/lib/marketSignals";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = (await triggerSignalGeneration()) ?? (await getCoinPool());
  const status = payload.error && !payload.isStale && !payload.isFallback ? 503 : 200;
  return NextResponse.json(payload, { status });
}
