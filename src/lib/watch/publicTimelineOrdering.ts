import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";

export function publicTimelineEventStableId(event: PublicTimelineEvent) {
  if (event.payload.kind === "pm_decision") {
    return `${event.payload.recordId}:${event.id}`;
  }
  return event.id;
}

export function comparePublicTimelineEvents(a: PublicTimelineEvent, b: PublicTimelineEvent) {
  const timeDelta = b.ts - a.ts;
  if (timeDelta !== 0) return timeDelta;

  const idDelta = publicTimelineEventStableId(a).localeCompare(publicTimelineEventStableId(b));
  if (idDelta !== 0) return idDelta;

  return a.id.localeCompare(b.id);
}

export function publicTimelinePmSymbolKey(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return null;
  const symbol = event.payload.symbol.trim().replace(/^\$+/, "").toUpperCase();
  return symbol && symbol !== "UNKNOWN" ? `${event.locale}:${symbol}` : null;
}

export function mergePublicTimelineEvents(events: readonly PublicTimelineEvent[]) {
  const byEventId = new Map<string, PublicTimelineEvent>();
  const byPmSymbol = new Map<string, PublicTimelineEvent>();

  for (const event of [...events].sort(comparePublicTimelineEvents)) {
    if (byEventId.has(event.id)) continue;

    const symbolKey = publicTimelinePmSymbolKey(event);
    if (symbolKey) {
      if (byPmSymbol.has(symbolKey)) continue;
      byPmSymbol.set(symbolKey, event);
    } else {
      byEventId.set(event.id, event);
    }
  }

  return [...Array.from(byEventId.values()), ...Array.from(byPmSymbol.values())].sort(
    comparePublicTimelineEvents,
  );
}
