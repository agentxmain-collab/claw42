import type { Locale } from "@/i18n/types";
import type { PublicWatchTimelinePayload } from "@/lib/watch/publicTimelinePayload";

export const WATCH_TIMELINE_SSE_HEADERS = {
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
} as const;

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_HEARTBEAT_MS = 15_000;
const DEFAULT_MAX_DURATION_MS = 55_000;
const DEFAULT_RETRY_MS = 3_000;

const encoder = new TextEncoder();

export interface WatchTimelineSseOptions {
  locale: Locale;
  loadPayload: () => Promise<PublicWatchTimelinePayload>;
  readVersion: (locale: Locale) => Promise<number>;
  limit?: number;
  windowMinutes?: number;
  pollIntervalMs?: number;
  heartbeatMs?: number;
  maxDurationMs?: number;
}

export function encodeSseEvent({
  event,
  id,
  retryMs,
  data,
}: {
  event: string;
  id?: string;
  retryMs?: number;
  data: unknown;
}) {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  if (retryMs) lines.push(`retry: ${retryMs}`);
  const dataString = JSON.stringify(data);
  for (const line of dataString.split("\n")) {
    lines.push(`data: ${line}`);
  }
  return `${lines.join("\n")}\n\n`;
}

function encodeHeartbeat(now = Date.now()) {
  return `: heartbeat ${now}\n\n`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createWatchTimelineSseStream({
  locale,
  loadPayload,
  readVersion,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
}: WatchTimelineSseOptions) {
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (message: string) => {
        if (!closed) controller.enqueue(encoder.encode(message));
      };

      const sendPayload = async () => {
        const payload = await loadPayload();
        enqueue(
          encodeSseEvent({
            event: "timeline",
            id: String(payload.servedAt),
            retryMs: DEFAULT_RETRY_MS,
            data: payload,
          }),
        );
        return payload;
      };

      const run = async () => {
        try {
          let lastVersion = await readVersion(locale);
          const initialPayload = await sendPayload();
          lastVersion = Math.max(lastVersion, initialPayload.servedAt);

          const startedAt = Date.now();
          let lastHeartbeatAt = Date.now();

          while (!closed && Date.now() - startedAt < maxDurationMs) {
            await sleep(pollIntervalMs);
            if (closed) return;

            const now = Date.now();
            const nextVersion = await readVersion(locale);
            if (nextVersion > lastVersion) {
              const payload = await sendPayload();
              lastVersion = Math.max(nextVersion, payload.servedAt);
              lastHeartbeatAt = now;
            } else if (now - lastHeartbeatAt >= heartbeatMs) {
              enqueue(encodeHeartbeat(now));
              lastHeartbeatAt = now;
            }
          }

          if (!closed) controller.close();
        } catch (error) {
          if (!closed) controller.error(error);
        }
      };

      void run();
    },
    cancel() {
      closed = true;
    },
  });
}
