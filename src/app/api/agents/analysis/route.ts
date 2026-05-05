import { NextResponse, type NextRequest } from "next/server";
import { getAgentAnalysis } from "@/lib/llmFallbackChain";
import { rateLimit } from "@/lib/rateLimit";
import { resolveAgentWatchLocale } from "@/modules/agent-watch/locale";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`agents:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const locale = resolveAgentWatchLocale(url.searchParams.get("locale") ?? "");
  const payload = await getAgentAnalysis(locale);
  return NextResponse.json(payload);
}
