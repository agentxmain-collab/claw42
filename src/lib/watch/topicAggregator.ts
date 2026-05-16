import type { Locale } from "@/i18n/types";
import {
  compareDecisionCandidateOrder,
  decisionCandidateDedupeKey,
  normalizeCandidateKey,
  normalizeCandidateSymbol,
  normalizeCandidateType,
  type CandidateType,
} from "@/lib/watch/decisionCandidate";
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
  candidateType: CandidateType;
  candidateKey: string;
  displayTitle?: string;
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
  return normalizeCandidateSymbol(event.payload.symbol);
}

function candidateIdentity(event: PmDecisionTimelineEvent) {
  const candidateType = normalizeCandidateType(event.payload.candidateType);
  const symbol = normalizedSymbol(event);
  if (candidateType === "symbol" && !symbol) return null;
  const candidateKey =
    normalizeCandidateKey(event.payload.candidateKey) ??
    (candidateType === "symbol" ? symbol : event.payload.recordId);
  const groupingKey = decisionCandidateDedupeKey({
    locale: event.locale,
    candidateType,
    candidateKey,
    symbol,
    recordId: event.payload.recordId,
    ts: event.ts,
  });
  const renderSymbol = symbol ?? (candidateType === "symbol" ? null : candidateKey);
  if (!candidateKey || !groupingKey || !renderSymbol) return null;
  return {
    candidateType,
    candidateKey,
    groupingKey,
    symbol: renderSymbol,
    displayTitle: event.payload.displayTitle,
  };
}

function buildGroupId(locale: Locale, candidateKey: string, latest: PmDecisionTimelineEvent) {
  return `${locale}:${candidateKey}:${latest.payload.recordId}`;
}

function uniqueEvidenceIds(events: PmDecisionTimelineEvent[]) {
  return Array.from(new Set(events.flatMap((event) => event.evidenceIds))).filter(Boolean);
}

function groupAcceptsEvent(
  group: DispatchTopicGroup,
  event: PmDecisionTimelineEvent,
  groupingKey: string,
) {
  return (
    group.locale === event.locale &&
    topicKey(group.locale, group.candidateType, group.candidateKey, group.latestAt) ===
      groupingKey &&
    group.latestAt - event.ts <= TOPIC_AGGREGATION_WINDOW_MS
  );
}

function topicKey(locale: Locale, candidateType: CandidateType, candidateKey: string, ts: number) {
  return (
    decisionCandidateDedupeKey({
      locale,
      candidateType,
      candidateKey,
      symbol: candidateType === "symbol" ? candidateKey : null,
      ts,
    }) ?? `${locale}:${candidateType}:${candidateKey}`
  );
}

function compareGroups(a: DispatchTopicGroup, b: DispatchTopicGroup) {
  return (
    compareDecisionCandidateOrder(
      {
        candidateType: a.candidateType,
        candidateKey: a.candidateKey,
        recordId: a.latestDecision.payload.recordId,
        symbol: a.symbol,
        lastUpdatedAt: a.latestAt,
      },
      {
        candidateType: b.candidateType,
        candidateKey: b.candidateKey,
        recordId: b.latestDecision.payload.recordId,
        symbol: b.symbol,
        lastUpdatedAt: b.latestAt,
      },
    ) ||
    publicTimelineEventStableId(a.latestDecision).localeCompare(
      publicTimelineEventStableId(b.latestDecision),
    )
  );
}

function finalizeGroup(group: DispatchTopicGroup): DispatchTopicGroup {
  const decisionsInWindow = [...group.decisionsInWindow].sort(comparePublicTimelineEvents);
  const latestDecision = decisionsInWindow[0];
  return {
    ...group,
    id: buildGroupId(group.locale, group.candidateKey, latestDecision),
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
    const identity = candidateIdentity(event);
    if (!identity) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[claw42] skipped pm_decision without candidate identity", {
          eventId: event.id,
          recordId: event.payload.recordId,
        });
      }
      continue;
    }

    const existing = groups.find((group) => groupAcceptsEvent(group, event, identity.groupingKey));
    if (existing) {
      existing.decisionsInWindow.push(event);
      existing.evidenceIds = uniqueEvidenceIds(existing.decisionsInWindow);
      existing.startedAt = Math.min(existing.startedAt, event.ts);
      continue;
    }

    const key = topicKey(event.locale, identity.candidateType, identity.candidateKey, event.ts);
    if (seenTopics.has(key)) continue;
    seenTopics.add(key);

    groups.push({
      id: buildGroupId(event.locale, identity.candidateKey, event),
      candidateType: identity.candidateType,
      candidateKey: identity.candidateKey,
      ...(identity.displayTitle ? { displayTitle: identity.displayTitle } : {}),
      symbol: identity.symbol,
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
