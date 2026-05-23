import {
  PUSH_WEBHOOK_FREQUENCY_WINDOW_SEC,
  PUSH_WEBHOOK_RETRY_COUNT,
  WEBHOOK_REQUEST_ID_HEADER,
} from "@/lib/coinw/externalEntryConstants";
import { checkRateLimit } from "@/lib/storage/kv-rate-limiter";

export type PushSignalType = "stage_change" | "trend_reversal" | "risk_alert";
export type PushSeverity = "low" | "medium" | "high";

export interface PushWebhookPayload {
  uid_hash: string;
  symbol: string;
  pair: string;
  signal_type: PushSignalType;
  severity: PushSeverity;
  title: string;
  body: string;
  deep_link: string;
  expires_at: string;
}

export type PushWebhookResult =
  | { status: "sent"; requestId: string }
  | { status: "frequency_capped"; requestId: string; resetAt: number }
  | { status: "not_configured"; requestId: string };

type FetchLike = typeof fetch;

export async function sendPushWebhook(
  payload: PushWebhookPayload,
  {
    fetchImpl = fetch,
    now = Date.now(),
    requestId = crypto.randomUUID(),
  }: {
    fetchImpl?: FetchLike;
    now?: number;
    requestId?: string;
  } = {},
): Promise<PushWebhookResult> {
  const frequency = await checkRateLimit(frequencyKey(payload, now), {
    max: 1,
    windowMs: PUSH_WEBHOOK_FREQUENCY_WINDOW_SEC * 1000,
  });
  if (!frequency.allowed) {
    console.info(
      JSON.stringify({
        type: "coinw_push_webhook",
        status: "frequency_capped",
        requestId,
        symbol: payload.symbol,
        signal_type: payload.signal_type,
      }),
    );
    return { status: "frequency_capped", requestId, resetAt: frequency.resetAt };
  }

  const url = process.env.COINW_PUSH_WEBHOOK_URL;
  const token = process.env.COINW_PUSH_WEBHOOK_TOKEN;
  if (!url || !token) {
    console.info(
      JSON.stringify({
        type: "coinw_push_webhook",
        status: "not_configured",
        requestId,
      }),
    );
    return { status: "not_configured", requestId };
  }

  await postWithRetry({
    url,
    token,
    requestId,
    payload,
    fetchImpl,
    retries: PUSH_WEBHOOK_RETRY_COUNT,
  });
  console.info(JSON.stringify({ type: "coinw_push_webhook", status: "sent", requestId }));
  return { status: "sent", requestId };
}

function frequencyKey(payload: PushWebhookPayload, now: number) {
  const windowStart = Math.floor(now / (PUSH_WEBHOOK_FREQUENCY_WINDOW_SEC * 1000));
  return [
    "coinw-push-webhook",
    sanitizeKeyPart(payload.uid_hash),
    sanitizeKeyPart(payload.symbol),
    sanitizeKeyPart(payload.signal_type),
    windowStart,
  ].join(":");
}

async function postWithRetry({
  url,
  token,
  requestId,
  payload,
  fetchImpl,
  retries,
}: {
  url: string;
  token: string;
  requestId: string;
  payload: PushWebhookPayload;
  fetchImpl: FetchLike;
  retries: number;
}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          [WEBHOOK_REQUEST_ID_HEADER]: requestId,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) return;
      lastError = new Error(`CoinW push webhook failed with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await sleep(100 * 2 ** (attempt - 1));
  }
  console.info(
    JSON.stringify({
      type: "coinw_push_webhook",
      status: "failed_after_retries",
      requestId,
    }),
  );
  throw lastError instanceof Error ? lastError : new Error("CoinW push webhook failed");
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
