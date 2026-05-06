import { NextRequest, NextResponse } from "next/server";
import { getDailyBrief } from "@/lib/dailyBrief";
import type { Locale } from "@/i18n/types";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: NextRequest) {
  const locale = (request.nextUrl.searchParams.get("locale") || "zh_CN") as Locale;
  const payload = await getDailyBrief(locale);
  return NextResponse.json(payload);
}
