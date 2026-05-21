import { NextResponse } from "next/server";
import { tradingReadinessPayload } from "@/lib/coinw/tradeReadinessState";
import { coinWOAuthReadiness } from "@/lib/coinw/oauthReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const readiness = coinWOAuthReadiness();
  return NextResponse.json(
    {
      ...readiness,
      tradeReadiness: tradingReadinessPayload(readiness.readinessStates),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
