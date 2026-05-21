import { NextResponse, type NextRequest } from "next/server";
import { readCoinWOrderIntentAudit } from "@/lib/coinw/orderIntentAuditStore";
import { tradingReadinessPayload } from "@/lib/coinw/tradeReadinessState";
import { coinWOAuthReadiness } from "@/lib/coinw/oauthReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request?: NextRequest) {
  const intentId = request?.nextUrl.searchParams.get("intentId")?.trim();
  if (intentId) {
    const audit = await readCoinWOrderIntentAudit(intentId);
    if (!audit) {
      return NextResponse.json(
        { error: "coinw_handoff_intent_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        intentId: audit.intentId,
        recordId: audit.recordId,
        status: audit.coinwStatus,
        coinwOrderId: audit.coinwOrderId,
        rejectErrorCode: audit.rejectErrorCode,
        callbackAt: audit.callbackAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

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
