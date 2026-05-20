import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildCoinWFuturesOrderIntent,
  type CoinWFuturesOrderDirection,
  type CoinWFuturesOrderIntentInput,
  type CoinWFuturesOrderType,
  type CoinWFuturesMarginMode,
} from "@/lib/coinw/futuresOrderIntent";
import {
  getCoinWFuturesInstrumentSet,
  staticCoinWFuturesInstrumentSet,
} from "@/lib/coinw/futuresInstruments";
import { coinWOAuthReadiness } from "@/lib/coinw/oauthReadiness";
import { checkRateLimit } from "@/lib/storage/kv-rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;
const DEFAULT_BETA_MAX_LEVERAGE = 3;

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function hashForRateLimit(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isDirection(value: unknown): value is CoinWFuturesOrderDirection {
  return value === "long" || value === "short";
}

function isOrderType(value: unknown): value is CoinWFuturesOrderType {
  return value === "market" || value === "limit";
}

function isMarginMode(value: unknown): value is CoinWFuturesMarginMode {
  return value === "isolated" || value === "cross";
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalDecimal(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function parseIntentInput(body: Record<string, unknown>): CoinWFuturesOrderIntentInput {
  const recordId = readString(body.recordId);
  const symbol = readString(body.symbol);
  const direction = body.direction;
  const orderType = body.orderType;
  const marginMode = body.marginMode;
  const leverage = Number(body.leverage);
  const quantity = body.quantity;

  if (!recordId || !symbol || !isDirection(direction) || !isOrderType(orderType)) {
    throw new Error("invalid_follow_intent_request");
  }
  if (!isMarginMode(marginMode) || !Number.isInteger(leverage)) {
    throw new Error("invalid_follow_intent_request");
  }
  if (typeof quantity !== "string" && typeof quantity !== "number") {
    throw new Error("invalid_follow_intent_request");
  }

  return {
    recordId,
    symbol,
    direction,
    orderType,
    quantity,
    price: readOptionalDecimal(body.price),
    leverage,
    marginMode,
    takeProfit: readOptionalDecimal(body.takeProfit),
    stopLoss: readOptionalDecimal(body.stopLoss),
  };
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("request_too_large");
  const body = (await request.json()) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("invalid_json");
  }
  return body as Record<string, unknown>;
}

async function resolveInstrumentSet() {
  if (process.env.NODE_ENV === "test") return staticCoinWFuturesInstrumentSet();
  return getCoinWFuturesInstrumentSet();
}

function errorStatus(errorCode: string) {
  if (errorCode === "rate_limited") return 429;
  if (errorCode === "request_too_large") return 413;
  return 400;
}

function betaMaxLeverage() {
  const parsed = Number(process.env.COINW_FUTURES_BETA_MAX_LEVERAGE);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BETA_MAX_LEVERAGE;
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(
    `watch-follow-intent:ip:${hashForRateLimit(clientIp(request))}`,
    {
      max: 5,
      windowMs: 60_000,
    },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const input = parseIntentInput(await readJson(request));
    const intent = buildCoinWFuturesOrderIntent(input, {
      instruments: await resolveInstrumentSet(),
      betaMaxLeverage: betaMaxLeverage(),
    });
    const readiness = coinWOAuthReadiness();

    return NextResponse.json(
      {
        mode: "disabled",
        reason: "coinw_real_submission_not_enabled",
        readiness,
        intent,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "invalid_follow_intent_request";
    return NextResponse.json(
      { error: errorCode },
      { status: errorStatus(errorCode), headers: { "Cache-Control": "no-store" } },
    );
  }
}
