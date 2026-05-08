import { NextResponse, type NextRequest } from "next/server";
import { getAgentAnalysis } from "@/lib/agentAnalysis";
import { generateText } from "@/lib/llm/generateText";
import { rateLimit } from "@/lib/rateLimit";
import { getHotSignals, getMajorEvent } from "@/lib/signal-engine";
import { resolveAgentWatchLocale } from "@/modules/agent-watch/locale";
import type { AgentId } from "@/modules/agent-watch/types";
import type { SignalCard } from "@/types/signal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`agents:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const agent = url.searchParams.get("agent")?.trim().toLowerCase();
  if (symbol || agent) {
    if (!symbol || !isAgentId(agent)) {
      return NextResponse.json({ error: "symbol and agent required" }, { status: 400 });
    }
    return getGroundedAgentAnalysis(symbol, agent);
  }

  const locale = resolveAgentWatchLocale(url.searchParams.get("locale") ?? "");
  const payload = await getAgentAnalysis(locale);
  return NextResponse.json(payload);
}

function isAgentId(value: string | undefined): value is AgentId {
  return value === "alpha" || value === "beta" || value === "gamma";
}

async function getGroundedAgentAnalysis(symbol: string, agentId: AgentId) {
  const primarySignal = await getPrimarySignalForSymbol(symbol);

  if (!primarySignal) {
    return NextResponse.json({
      content: `${agentId} 暂时没有 ${symbol} 的可靠信号，等数据。`,
      signalCardId: null,
      dataLayer: null,
      generatedAt: Date.now(),
    });
  }

  const text = await generateText(buildGroundedPrompt(symbol, agentId, primarySignal), {
    taskTag: `analysis:${agentId}:${symbol}`,
    temperature: 0.7,
    maxTokens: 200,
    enableCache: true,
    enableGuardrails: true,
  });

  return NextResponse.json({
    content: text,
    signalCardId: primarySignal.id,
    dataLayer: "all",
    generatedAt: Date.now(),
  });
}

async function getPrimarySignalForSymbol(symbol: string): Promise<SignalCard | null> {
  const hotSignals = await getHotSignals(10);
  const matched = hotSignals.find((signal) => signalMatchesSymbol(signal, symbol));
  if (matched) return matched;

  const majorEvent = await getMajorEvent();
  return majorEvent.event && signalMatchesSymbol(majorEvent.event, symbol)
    ? majorEvent.event
    : null;
}

function signalMatchesSymbol(signal: SignalCard, symbol: string): boolean {
  return (
    signal.impact.primaryAsset.toUpperCase() === symbol ||
    signal.impact.relatedAssets.some((asset) => asset.symbol.toUpperCase() === symbol)
  );
}

function buildGroundedPrompt(symbol: string, agentId: AgentId, signal: SignalCard): string {
  return `You are Agent ${agentId}. Give one short crypto-market analysis for ${symbol}.

Base the answer only on this SignalCard:
${JSON.stringify(signal, null, 2)}

Requirements:
- 30-60 Chinese characters when possible
- mention at least one concrete data point from the SignalCard
- do not invent prices, percentages, or evidence
- if a field is missing, say that data is insufficient`;
}
