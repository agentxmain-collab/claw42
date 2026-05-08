import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 4096;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 5;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const VITAL_NAMES = new Set(["CLS", "LCP", "FCP", "TTFB", "INP"]);

type VitalPayload = {
  name: string;
  value: number;
  id: string;
  navigationType: string;
  url: string;
  ts: string;
  sessionId: string;
};

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!allowRequest(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }

    const payload = cleanPayload(JSON.parse(rawBody));
    if (!payload) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const date = payload.ts.slice(0, 10);
    await Promise.allSettled([
      appendKvLine(`vitals:${date}:${payload.name}`, payload),
      writeLocalJsonl("vitals", date, payload),
    ]);

    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

function cleanPayload(value: unknown): VitalPayload | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== "string" || !VITAL_NAMES.has(value.name)) return null;
  if (typeof value.value !== "number" || !Number.isFinite(value.value)) return null;
  if (typeof value.id !== "string" || value.id.length > 120) return null;
  if (typeof value.sessionId !== "string" || value.sessionId.length > 120) return null;

  return {
    name: value.name,
    value: value.value,
    id: value.id,
    navigationType:
      typeof value.navigationType === "string" ? value.navigationType.slice(0, 80) : "unknown",
    url: typeof value.url === "string" ? value.url.slice(0, 500) : "",
    ts: validIso(value.ts) ? value.ts : new Date().toISOString(),
    sessionId: value.sessionId,
  };
}

async function appendKvLine(key: string, payload: VitalPayload) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["LPUSH", key, JSON.stringify(payload)]),
  });
}

async function writeLocalJsonl(folder: string, date: string, payload: VitalPayload) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return;

  const dir = join(process.cwd(), "reports", folder);
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, `${date}.jsonl`), `${JSON.stringify(payload)}\n`, "utf8");
}

function allowRequest(ip: string) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
