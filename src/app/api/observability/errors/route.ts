import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_LENGTH = 16_384;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 10;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

type ErrorPayload = {
  message: string;
  stack?: string;
  context: unknown;
  url: string;
  ts: string;
  sessionId: string;
  errorId: string;
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
      writeKv(`errors:${date}:${payload.errorId}`, payload),
      writeLocalJsonl(date, payload),
    ]);

    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

function cleanPayload(value: unknown): ErrorPayload | null {
  if (!isRecord(value)) return null;
  if (typeof value.message !== "string" || value.message.length === 0) return null;
  if (typeof value.errorId !== "string" || value.errorId.length > 120) return null;
  if (typeof value.sessionId !== "string" || value.sessionId.length > 120) return null;

  return {
    message: value.message.slice(0, 500),
    stack: typeof value.stack === "string" ? value.stack.slice(0, 5000) : undefined,
    context: value.context ?? {},
    url: typeof value.url === "string" ? value.url.slice(0, 500) : "",
    ts: validIso(value.ts) ? value.ts : new Date().toISOString(),
    sessionId: value.sessionId,
    errorId: value.errorId,
  };
}

async function writeKv(key: string, payload: ErrorPayload) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", key, JSON.stringify(payload), "EX", "604800"]),
  });
}

async function writeLocalJsonl(date: string, payload: ErrorPayload) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return;

  const dir = join(process.cwd(), "reports", "errors");
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
