import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import { isPublicDisplayablePmDecisionEvent } from "@/lib/watch/publicPmDecisionDisplay";
import {
  compareDecisionCandidateOrder,
  decisionCandidateDedupeKey,
  normalizeCandidateType,
} from "@/lib/watch/decisionCandidate";

export function publicTimelineEventStableId(event: PublicTimelineEvent) {
  if (event.payload.kind === "pm_decision") {
    return `${event.payload.recordId}:${event.id}`;
  }
  return event.id;
}

export function comparePublicTimelineEvents(a: PublicTimelineEvent, b: PublicTimelineEvent) {
  if (a.payload.kind === "pm_decision" && b.payload.kind === "pm_decision") {
    const candidateDelta = compareDecisionCandidateOrder(
      publicTimelineEventCandidateOrderKey(a),
      publicTimelineEventCandidateOrderKey(b),
    );
    if (candidateDelta !== 0) return candidateDelta;
  }

  const timeDelta = b.ts - a.ts;
  if (timeDelta !== 0) return timeDelta;

  const idDelta = publicTimelineEventStableId(a).localeCompare(publicTimelineEventStableId(b));
  if (idDelta !== 0) return idDelta;

  return a.id.localeCompare(b.id);
}

function publicTimelineEventCandidateOrderKey(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") {
    return { lastUpdatedAt: event.ts, recordId: event.id };
  }
  return {
    candidateType: event.payload.candidateType,
    candidateKey: event.payload.candidateKey,
    recordId: event.payload.recordId,
    symbol: event.payload.symbol,
    lastUpdatedAt: event.ts,
  };
}

export function publicTimelinePmCandidateKey(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return null;
  return decisionCandidateDedupeKey({
    locale: event.locale,
    candidateType: event.payload.candidateType,
    candidateKey: event.payload.candidateKey,
    symbol: event.payload.symbol,
    recordId: event.payload.recordId,
    ts: event.ts,
  });
}

export function publicTimelinePmSymbolKey(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return null;
  if (normalizeCandidateType(event.payload.candidateType) !== "symbol") return null;
  const symbol = event.payload.symbol.trim().replace(/^\$+/, "").toUpperCase();
  return symbol && symbol !== "UNKNOWN" ? `${event.locale}:${symbol}` : null;
}

export function mergePublicTimelineEvents(events: readonly PublicTimelineEvent[]) {
  const byEventId = new Map<string, PublicTimelineEvent>();
  const byPmCandidate = new Map<string, PublicTimelineEvent>();

  for (const event of [...events].sort(comparePublicTimelineEvents)) {
    if (byEventId.has(event.id)) continue;

    const candidateKey = publicTimelinePmCandidateKey(event);
    if (candidateKey) {
      const existing = byPmCandidate.get(candidateKey);
      if (existing) {
        if (
          !isPublicDisplayablePmDecisionEvent(existing) &&
          isPublicDisplayablePmDecisionEvent(event)
        ) {
          byPmCandidate.set(candidateKey, event);
        }
        continue;
      }
      byPmCandidate.set(candidateKey, event);
    } else {
      byEventId.set(event.id, event);
    }
  }

  return [...Array.from(byEventId.values()), ...Array.from(byPmCandidate.values())].sort(
    comparePublicTimelineEvents,
  );
}
