import {
  TASK_PROGRESS_RETRY_COUNT,
  WEBHOOK_REQUEST_ID_HEADER,
} from "@/lib/coinw/externalEntryConstants";

export interface TaskProgressWebhookPayload {
  uid_hash: string;
  task_id: string;
  landing_id: string;
  event: "claw42_dwell_60s_reached";
  dwell_ms: number;
  ts: string;
}

type FetchLike = typeof fetch;

export async function sendTaskProgressWebhook(
  payload: TaskProgressWebhookPayload,
  requestId: string,
  {
    fetchImpl = fetch,
  }: {
    fetchImpl?: FetchLike;
  } = {},
) {
  const url = process.env.COINW_TASK_PROGRESS_WEBHOOK_URL;
  const token = process.env.COINW_TASK_PROGRESS_WEBHOOK_TOKEN;
  if (!url || !token) {
    throw new Error("CoinW task progress webhook is not configured");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= TASK_PROGRESS_RETRY_COUNT; attempt++) {
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
      if (response.ok) {
        console.info(
          JSON.stringify({ type: "coinw_task_progress_webhook", status: "sent", requestId }),
        );
        return;
      }
      lastError = new Error(`CoinW task progress webhook failed with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < TASK_PROGRESS_RETRY_COUNT) await sleep(100 * 2 ** (attempt - 1));
  }

  console.info(
    JSON.stringify({
      type: "coinw_task_progress_webhook",
      status: "failed_after_retries",
      requestId,
    }),
  );
  throw lastError instanceof Error ? lastError : new Error("CoinW task progress webhook failed");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
