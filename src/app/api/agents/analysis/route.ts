import { NextResponse } from "next/server";
import { getAgentAnalysis } from "@/lib/llmFallbackChain";
import { resolveAgentWatchLocale } from "@/modules/agent-watch/locale";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = resolveAgentWatchLocale(url.searchParams.get("locale") ?? "");
  const payload = await getAgentAnalysis(locale);
  return NextResponse.json(payload);
}
