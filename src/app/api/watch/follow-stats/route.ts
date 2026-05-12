import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/storage/kv-rate-limiter";
import { followRecord, getFollowStats } from "@/lib/watch/followStatsStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ANON_COOKIE = "claw42-anon-id";
const ANON_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const MAX_RECORD_IDS = 50;
const RECORD_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,160}$/;

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isValidRecordId(recordId: string) {
  return RECORD_ID_PATTERN.test(recordId);
}

function parseRecordIds(value: string | null) {
  if (!value) return [];
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean))).slice(
    0,
    MAX_RECORD_IDS,
  );
}

function getOrCreateAnonId(request: NextRequest) {
  const existing = request.cookies.get(ANON_COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9:_-]{16,160}$/.test(existing)) {
    return { anonId: existing, shouldSetCookie: false };
  }
  return { anonId: randomUUID(), shouldSetCookie: true };
}

function setAnonCookie(response: NextResponse, anonId: string, shouldSetCookie: boolean) {
  if (!shouldSetCookie) return;
  response.cookies.set(ANON_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
  });
}

function jsonWithAnonCookie(
  body: unknown,
  anon: { anonId: string; shouldSetCookie: boolean },
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
  setAnonCookie(response, anon.anonId, anon.shouldSetCookie);
  return response;
}

async function canMutateFollowStats(request: NextRequest, anonId: string) {
  const ip = getClientIp(request);
  const [ipLimit, anonLimit] = await Promise.all([
    checkRateLimit(`watch-follow:ip:${ip}`, { max: 30, windowMs: 60_000 }),
    checkRateLimit(`watch-follow:anon:${anonId}`, { max: 10, windowMs: 60_000 }),
  ]);
  return ipLimit.allowed && anonLimit.allowed;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const recordIds = parseRecordIds(url.searchParams.get("recordIds"));
  if (recordIds.length === 0 || recordIds.some((recordId) => !isValidRecordId(recordId))) {
    return NextResponse.json({ error: "invalid_record_ids" }, { status: 400 });
  }

  const anon = getOrCreateAnonId(request);
  const stats = await getFollowStats(recordIds, anon.anonId);
  return jsonWithAnonCookie({ stats }, anon);
}

export async function POST(request: NextRequest) {
  const anon = getOrCreateAnonId(request);
  let body: { recordId?: unknown; action?: unknown };
  try {
    body = (await request.json()) as { recordId?: unknown; action?: unknown };
  } catch {
    return jsonWithAnonCookie({ error: "invalid_json" }, anon, { status: 400 });
  }

  if (body.action !== "follow" || typeof body.recordId !== "string" || !isValidRecordId(body.recordId)) {
    return jsonWithAnonCookie({ error: "invalid_follow_request" }, anon, { status: 400 });
  }

  const allowed = await canMutateFollowStats(request, anon.anonId);
  if (!allowed) {
    return jsonWithAnonCookie({ error: "rate_limited" }, anon, { status: 429 });
  }

  const stats = await followRecord(body.recordId, anon.anonId);
  return jsonWithAnonCookie({ recordId: body.recordId, stats }, anon);
}
