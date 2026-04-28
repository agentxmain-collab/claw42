import { NextResponse } from "next/server";
import { getAgentAnalysis } from "@/lib/llmFallbackChain";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getAgentAnalysis();
  return NextResponse.json(payload);
}
