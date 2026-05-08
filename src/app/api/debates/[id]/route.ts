import { NextResponse, type NextRequest } from "next/server";
import { getNewsDebate, listNewsDebates } from "@/lib/debateOrchestrator";
import { projectDebate } from "@/lib/projectDebate";
import type { DebateProjectionView } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function projectionView(value: string | null): DebateProjectionView {
  if (value === "operator" || value === "share") return value;
  return "public";
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(request.url);
  const view = projectionView(url.searchParams.get("view"));
  const id = decodeURIComponent(params.id);
  const debate = id === "latest" ? listNewsDebates(1)[0] : getNewsDebate(id);

  if (!debate) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(projectDebate(debate, view));
}
