import { NextResponse, type NextRequest } from "next/server";
import { getCoinPool } from "@/lib/marketDataCache";
import { manualCloseDecisionRecord, ManualCloseDecisionError } from "@/lib/team/manualCloseHandler";
import { localeFromRequestUrl } from "@/lib/watch/locale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const token = process.env.ADMIN_API_TOKEN;
  return Boolean(token) && request.headers.get("x-admin-token") === token;
}

async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => ({}));
}

function observedPriceFromBody(body: unknown) {
  if (!body || typeof body !== "object" || !("observedPrice" in body)) return null;
  const value = (body as { observedPrice?: unknown }).observedPrice;
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function priceMapFromPool(pool: Awaited<ReturnType<typeof getCoinPool>>) {
  return new Map(
    [...pool.majors, ...pool.trending, ...pool.opportunity].flatMap((item) => {
      const symbol = item.symbol.trim().replace(/^\$+/, "").toUpperCase();
      return symbol && Number.isFinite(item.price) && item.price > 0
        ? ([[symbol, item.price]] as const)
        : [];
    }),
  );
}

function errorResponse(error: ManualCloseDecisionError) {
  switch (error.code) {
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "already_resolved":
      return NextResponse.json({ error: "idempotency_conflict" }, { status: 409 });
    case "missing_price":
      return NextResponse.json({ error: "missing_price" }, { status: 400 });
    default:
      return NextResponse.json({ error: "manual_close_failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJson(request);
  const observedPrice = observedPriceFromBody(body);
  const locale = localeFromRequestUrl(new URL(request.url), request.headers.get("accept-language"));
  const pool = observedPrice ? null : await getCoinPool();

  try {
    const result = await manualCloseDecisionRecord({
      recordId: decodeURIComponent(params.id),
      locale,
      observedPrice,
      priceBySymbol: pool ? priceMapFromPool(pool) : undefined,
    });
    return NextResponse.json({
      ok: true,
      recordId: result.record.id,
      outcome: result.resolution.outcome,
      resolvedAt: result.resolution.resolvedAt,
      observedPrice: result.resolution.observedPrice,
      observedPriceSource: result.resolution.observedPriceSource,
      reason: result.resolution.reason,
    });
  } catch (error) {
    if (error instanceof ManualCloseDecisionError) return errorResponse(error);
    return NextResponse.json({ error: "manual_close_failed" }, { status: 500 });
  }
}
