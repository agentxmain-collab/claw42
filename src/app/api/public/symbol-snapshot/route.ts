import { NextResponse, type NextRequest } from "next/server";
import {
  SYMBOL_SNAPSHOT_CACHE_TTL_SEC,
  SYMBOL_SNAPSHOT_RATE_LIMIT_QPS,
} from "@/lib/coinw/externalEntryConstants";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeWatchLocale } from "@/lib/watch/locale";
import { getPublicSymbolSnapshot } from "@/lib/watch/publicSymbolSnapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`public-symbol-snapshot:${ip}`, SYMBOL_SNAPSHOT_RATE_LIMIT_QPS, 1000)) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": "1" },
      },
    );
  }

  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const lang = normalizeWatchLocale(
    request.nextUrl.searchParams.get("lang") ?? request.nextUrl.searchParams.get("locale"),
  );
  const snapshot = await getPublicSymbolSnapshot(symbol, lang);
  if (!snapshot) {
    return NextResponse.json(
      { error: "no_data" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${SYMBOL_SNAPSHOT_CACHE_TTL_SEC}, stale-while-revalidate=60`,
    },
  });
}
