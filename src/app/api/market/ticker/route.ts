import { NextResponse } from "next/server";
import { getMarketTickers } from "@/lib/marketDataCache";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getMarketTickers();
  const status = payload.error && !payload.isStale && !payload.isFallback ? 503 : 200;
  return NextResponse.json(payload, { status });
}
