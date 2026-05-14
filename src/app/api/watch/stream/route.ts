import { subscribeSharedThread } from "@/lib/sharedThreadStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function canReadDebugStream(request: Request) {
  return process.env.NODE_ENV !== "production" && request.headers.get("x-claw42-debug") === "1";
}

export async function GET(request: Request) {
  if (!canReadDebugStream(request)) {
    return Response.json({ error: "debug stream unavailable" }, { status: 403 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTC";
  const stream = subscribeSharedThread(symbol);

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
