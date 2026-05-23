import { NextResponse, type NextRequest } from "next/server";
import {
  isCoinWHandoffStatus,
  updateCoinWOrderIntentAuditStatus,
} from "@/lib/coinw/orderIntentAuditStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const intentId = readString(body?.intentId);
  const status = readString(body?.status);
  const coinwOrderId = readString(body?.coinwOrderId) || null;
  const rejectErrorCode = readString(body?.rejectErrorCode) || null;

  if (!intentId || !isCoinWHandoffStatus(status) || status === "created" || status === "opened") {
    return NextResponse.json(
      { error: "invalid_coinw_handoff_callback" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const audit = await updateCoinWOrderIntentAuditStatus(intentId, {
    status,
    coinwOrderId,
    rejectErrorCode,
  });
  if (!audit) {
    return NextResponse.json(
      { error: "coinw_handoff_intent_not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      intentId: audit.intentId,
      status: audit.coinwStatus,
      coinwOrderId: audit.coinwOrderId,
      rejectErrorCode: audit.rejectErrorCode,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
