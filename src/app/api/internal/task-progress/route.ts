import { NextResponse, type NextRequest } from "next/server";
import { TASK_PROGRESS_IDEMPOTENCY_TTL_SEC } from "@/lib/coinw/externalEntryConstants";
import {
  sendTaskProgressWebhook,
  type TaskProgressWebhookPayload,
} from "@/lib/coinw/taskProgressWebhookClient";
import { atomicClaim, markIdempotencyState } from "@/lib/storage/kv-idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UnknownRecord = Record<string, unknown>;

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", requestId }, { status: 400 });
  }

  const payload = parseTaskProgressPayload(body);
  if (!payload) {
    return NextResponse.json({ error: "invalid_payload", requestId }, { status: 400 });
  }

  const key = buildTaskProgressIdempotencyKey(payload.uid_hash, payload.task_id);
  const claim = await atomicClaim(key, requestId, TASK_PROGRESS_IDEMPOTENCY_TTL_SEC);
  if (!claim.claimed) {
    return NextResponse.json(
      {
        status: "already_claimed",
        existingState: claim.existingRecord?.state ?? "unknown",
        existingRequestId: claim.existingRecord?.requestId,
        claimedAt: claim.existingRecord?.claimedAt,
        requestId,
      },
      { status: 200 },
    );
  }

  try {
    await sendTaskProgressWebhook(payload, requestId);
    await markIdempotencyState(key, "sent", TASK_PROGRESS_IDEMPOTENCY_TTL_SEC);
    return NextResponse.json({ status: "sent", requestId }, { status: 200 });
  } catch {
    await markIdempotencyState(key, "failed", TASK_PROGRESS_IDEMPOTENCY_TTL_SEC);
    return NextResponse.json({ status: "failed", requestId }, { status: 500 });
  }
}

function buildTaskProgressIdempotencyKey(uidHash: string, taskId: string) {
  return `coinw:task_progress:${sanitizeKeyPart(uidHash)}:${sanitizeKeyPart(taskId)}`;
}

function parseTaskProgressPayload(value: unknown): TaskProgressWebhookPayload | null {
  if (!isRecord(value)) return null;
  const uidHash = stringField(value.uid_hash, 128);
  const taskId = stringField(value.task_id, 100);
  const landingId = stringField(value.landing_id, 80);
  const dwellMs = numberField(value.dwell_ms);
  const ts = stringField(value.ts, 40);
  if (!uidHash || !taskId || !landingId || !ts || dwellMs === null) return null;
  if (value.event !== "claw42_dwell_60s_reached") return null;

  return {
    uid_hash: uidHash,
    task_id: taskId,
    landing_id: landingId,
    event: "claw42_dwell_60s_reached",
    dwell_ms: dwellMs,
    ts,
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128);
}
