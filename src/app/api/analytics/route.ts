import { NextResponse } from "next/server";
import { ANALYTICS_EVENTS, type AnalyticsValue } from "@/lib/analytics";

const MAX_BODY_LENGTH = 4096;
const MAX_PROPERTY_KEYS = 24;
const MAX_VALUE_LENGTH = 240;
const ALLOWED_EVENTS = new Set<string>(ANALYTICS_EVENTS);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanValue(value: unknown): AnalyticsValue | undefined {
  if (typeof value === "string") return value.slice(0, MAX_VALUE_LENGTH);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean" || value === null) return value;
  return undefined;
}

function cleanProperties(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.entries(value)
    .slice(0, MAX_PROPERTY_KEYS)
    .reduce<Record<string, AnalyticsValue>>((acc, [key, item]) => {
      const clean = cleanValue(item);
      if (clean !== undefined) acc[key.slice(0, 80)] = clean;
      return acc;
    }, {});
}

function getDeviceType(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    const payload: unknown = JSON.parse(rawBody);
    if (!isRecord(payload) || typeof payload.event !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(payload.event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const context = isRecord(payload.context) ? payload.context : {};
    const userAgent = request.headers.get("user-agent") ?? "";
    const event = {
      type: "claw42_analytics",
      event: payload.event,
      ts: new Date().toISOString(),
      path: typeof context.path === "string" ? context.path.slice(0, 240) : undefined,
      referrer:
        typeof context.referrer === "string"
          ? context.referrer.slice(0, 240)
          : undefined,
      viewport:
        typeof context.viewport === "string"
          ? context.viewport.slice(0, 40)
          : undefined,
      language:
        typeof context.language === "string"
          ? context.language.slice(0, 40)
          : undefined,
      device: getDeviceType(userAgent),
      utm: cleanProperties(context.utm),
      properties: cleanProperties(payload.properties),
    };

    console.info(JSON.stringify(event));
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
