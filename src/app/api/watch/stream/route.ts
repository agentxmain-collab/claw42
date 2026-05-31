import { NextResponse } from "next/server";
import { subscribeSharedThread } from "@/lib/sharedThreadStore";
import { WATCH_TIMELINE_SSE_HEADERS } from "@/lib/watch/sseBroker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function canReadDebugStream(request: Request) {
  return process.env.NODE_ENV !== "production" && request.headers.get("x-claw42-debug") === "1";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "thread") {
    if (!canReadDebugStream(request)) {
      return Response.json({ error: "debug stream unavailable" }, { status: 403 });
    }

    const symbol = url.searchParams.get("symbol") ?? "BTC";
    const stream = subscribeSharedThread(symbol);

    return new Response(stream, {
      headers: WATCH_TIMELINE_SSE_HEADERS,
    });
  }

  return NextResponse.json(
    { error: "public_stream_disabled" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
