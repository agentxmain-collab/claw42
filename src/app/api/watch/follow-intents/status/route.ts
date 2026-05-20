import { NextResponse } from "next/server";
import { coinWOAuthReadiness } from "@/lib/coinw/oauthReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(coinWOAuthReadiness(), {
    headers: { "Cache-Control": "no-store" },
  });
}
