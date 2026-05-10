import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export function fallbackBeforeForPublicTimeline(
  payload: { events: Pick<PublicTimelineEvent, "ts">[] },
  now = Date.now(),
) {
  if (payload.events.length === 0) return now;

  return payload.events.reduce(
    (oldest, event) => Math.min(oldest, event.ts),
    payload.events[0]!.ts,
  );
}
