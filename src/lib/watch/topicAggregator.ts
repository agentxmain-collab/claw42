import type { Locale } from "@/i18n/types";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  comparePublicTimelineEvents,
  publicTimelineEventStableId,
} from "@/lib/watch/publicTimelineOrdering";

export const TOPIC_AGGREGATION_WINDOW_MS = 30 * 60 * 1000;

export type PmDecisionTimelineEvent = PublicTimelineEvent & {
  payload: Extract<PublicTimelineEvent["payload"], { kind: "pm_decision" }>;
};

export interface DispatchTopicGroup {
  id: string;
  symbol: string;
  locale: Locale;
  latestDecision: PmDecisionTimelineEvent;
  decisionsInWindow: PmDecisionTimelineEvent[];
  evidenceIds: string[];
  startedAt: number;
  latestAt: number;
}

function isPmDecisionEvent(event: PublicTimelineEvent): event is PmDecisionTimelineEvent {
  return event.payload.kind === "pm_decision";
}

function normalizedSymbol(event: PmDecisionTimelineEvent) {
  if (typeof event.payload.symbol !== "string") return null;
  const symbol = event.payload.symbol.trim().replace(/^\$+/, "").toUpperCase();
  return symbol && symbol !== "UNKNOWN" ? symbol : null;
}

function buildGroupId(locale: Locale, symbol: string, latest: PmDecisionTimelineEvent) {
  return `${locale}:${symbol}:${latest.payload.recordId}`;
}

function uniqueEvidenceIds(events: PmDecisionTimelineEvent[]) {
  return Array.from(new Set(events.flatMap((event) => event.evidenceIds))).filter(Boolean);
}

function groupAcceptsEvent(
  group: DispatchTopicGroup,
  event: PmDecisionTimelineEvent,
  symbol: string,
) {
  return (
    group.locale === event.locale &&
    group.symbol === symbol &&
    group.latestAt - event.ts <= TOPIC_AGGREGATION_WINDOW_MS
  );
}

function topicKey(locale: Locale, symbol: string) {
  return `${locale}:${symbol}`;
}

function compareGroups(a: DispatchTopicGroup, b: DispatchTopicGroup) {
  const timeDelta = b.latestAt - a.latestAt;
  if (timeDelta !== 0) return timeDelta;
  return publicTimelineEventStableId(a.latestDecision).localeCompare(
    publicTimelineEventStableId(b.latestDecision),
  );
}

function finalizeGroup(group: DispatchTopicGroup): DispatchTopicGroup {
  const decisionsInWindow = [...group.decisionsInWindow].sort(comparePublicTimelineEvents);
  const latestDecision = decisionsInWindow[0];
  return {
    ...group,
    id: buildGroupId(group.locale, group.symbol, latestDecision),
    latestDecision,
    decisionsInWindow,
    evidenceIds: uniqueEvidenceIds(decisionsInWindow),
    startedAt: decisionsInWindow[decisionsInWindow.length - 1]?.ts ?? group.latestAt,
    latestAt: latestDecision.ts,
  };
}

export function groupPublicTimelineEventsByTopic(
  events: readonly PublicTimelineEvent[],
): DispatchTopicGroup[] {
  const groups: DispatchTopicGroup[] = [];
  const decisions = events.filter(isPmDecisionEvent).sort(comparePublicTimelineEvents);
  const seenTopics = new Set<string>();

  for (const event of decisions) {
    const symbol = normalizedSymbol(event);
    if (!symbol) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[claw42] skipped pm_decision without symbol", {
          eventId: event.id,
          recordId: event.payload.recordId,
        });
      }
      continue;
    }

    const existing = groups.find((group) => groupAcceptsEvent(group, event, symbol));
    if (existing) {
      existing.decisionsInWindow.push(event);
      existing.evidenceIds = uniqueEvidenceIds(existing.decisionsInWindow);
      existing.startedAt = Math.min(existing.startedAt, event.ts);
      continue;
    }

    const key = topicKey(event.locale, symbol);
    if (seenTopics.has(key)) continue;
    seenTopics.add(key);

    groups.push({
      id: buildGroupId(event.locale, symbol, event),
      symbol,
      locale: event.locale,
      latestDecision: event,
      decisionsInWindow: [event],
      evidenceIds: uniqueEvidenceIds([event]),
      startedAt: event.ts,
      latestAt: event.ts,
    });
  }

  return groups.map(finalizeGroup).sort(compareGroups);
}
