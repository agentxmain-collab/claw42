import type { Locale } from "@/i18n/types";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { getNewsEvidence } from "@/lib/news/newsEvidenceStore";
import { readAllDecisionRecords, readDecisionRecords } from "@/lib/team/decisionRecordStore";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { knownSymbolMappings, resolveSymbolMapping } from "@/lib/team/symbolMapping";
import { readPmDecisionJobs } from "@/lib/watch/pmDecisionJobLedger";
import {
  deriveResidentPrewarmStatus,
  type ResidentPrewarmStatus,
} from "@/lib/watch/residentPrewarmStatus";
import type { StreamEntry } from "@/modules/agent-watch/types";
import { getWatchHistory } from "@/lib/watchHistoryStore";
import {
  getStagingMockTimeline,
  shouldUseStagingMockTimeline,
} from "@/lib/watch/__fixtures__/stagingMockTimeline";
import type { PublicTimelineEvent } from "@/lib/watch/publicTimelineEvent";
import {
  comparePublicTimelineEvents,
  mergePublicTimelineEvents,
} from "@/lib/watch/publicTimelineOrdering";
import { normalizeCandidateType } from "@/lib/watch/decisionCandidate";
import {
  buildDecisionRecordIndex,
  filterPublicTimelineEvents,
  projectDecisionRecordToPublicEvent,
} from "@/lib/watch/publicTimelineProjection";

export const MAX_PUBLIC_TIMELINE_WINDOW_MINUTES = 24 * 60;
export const MAX_PUBLIC_RESIDENT_FLOOR_WINDOW_MINUTES = 72 * 60;
export const PUBLIC_SYMBOL_FLOOR_TARGET = 3;
export const PUBLIC_NEWS_DRIVEN_SYMBOL_MAX_AGE_MS = 6 * 60 * 60_000;

const MAX_EVIDENCE_MAP_ITEMS = 120;
const NEWS_DRIVEN_CANDIDATE_KEY_PREFIX = "news-driven:";
const SIMPLE_PIPELINE_PROMPT_VERSION = "simple-pipeline:v1";

export type WatchTimelineMode = "public" | "debug";

export interface PublicWatchTimelinePayload {
  events: PublicTimelineEvent[];
  evidenceMap: Record<string, NewsEvidence>;
  oldestTs: number | null;
  hasMore: boolean;
  windowMinutes: number;
  locale: Locale;
  servedAt: number;
  nextPollMs: number;
  residentStatus?: ResidentPrewarmStatus;
}

export interface DebugWatchTimelinePayload {
  entries: StreamEntry[];
  oldestTs: number | null;
  hasMore: boolean;
  windowMinutes: number;
  locale: Locale;
  servedAt: number;
  nextPollMs: number;
}

export type WatchTimelinePayload = PublicWatchTimelinePayload | DebugWatchTimelinePayload;

export interface WatchTimelinePayloadOptions {
  mode: WatchTimelineMode;
  locale: Locale;
  before: number;
  since?: number;
  limit: number;
  windowMinutes: number;
  servedAt?: number;
}

export function resolveWatchTimelineNextPollMs(servedAt: number) {
  return servedAt % (3 * 60_000) < 30_000 ? 30_000 : 90_000;
}

export function resolvePublicTimelineRecordCutoff(servedAt: number, windowMinutes: number) {
  return (
    servedAt - Math.max(1, Math.min(windowMinutes, MAX_PUBLIC_TIMELINE_WINDOW_MINUTES)) * 60_000
  );
}

function shouldReplaceWithRecordEvent(
  existing: PublicTimelineEvent,
  recordEvent: PublicTimelineEvent,
) {
  if (existing.payload.kind !== "pm_decision" || recordEvent.payload.kind !== "pm_decision") {
    return false;
  }
  return (
    existing.payload.symbol === "UNKNOWN" ||
    !existing.payload.rounds?.length ||
    existing.payload.tradeDecision == null
  );
}

function mergeDecisionRecordBackfillEvents(
  events: PublicTimelineEvent[],
  recordEvents: PublicTimelineEvent[],
  limit: number,
) {
  const byRecordId = new Map<string, PublicTimelineEvent>();
  const passthrough: PublicTimelineEvent[] = [];

  for (const event of events) {
    if (event.payload.kind === "pm_decision") {
      byRecordId.set(event.payload.recordId, event);
    } else {
      passthrough.push(event);
    }
  }

  for (const recordEvent of recordEvents) {
    if (recordEvent.payload.kind !== "pm_decision") continue;
    const existing = byRecordId.get(recordEvent.payload.recordId);
    if (!existing || shouldReplaceWithRecordEvent(existing, recordEvent)) {
      byRecordId.set(recordEvent.payload.recordId, recordEvent);
    }
  }

  return mergePublicTimelineEvents([...passthrough, ...Array.from(byRecordId.values())]).slice(
    0,
    limit,
  );
}

export function selectResidentFloorRecordEvents(
  _events: PublicTimelineEvent[],
  _options: {
    locale: Locale;
    before: number;
    since?: number;
    servedAt: number;
  },
): PublicTimelineEvent[] {
  void _events;
  void _options;
  return [];
}

function isFreshNewsDrivenSymbolEvent(event: PublicTimelineEvent, servedAt: number) {
  if (event.payload.kind !== "pm_decision") return false;
  if (normalizeCandidateType(event.payload.candidateType) !== "symbol") return false;
  if (!event.payload.candidateKey?.startsWith(NEWS_DRIVEN_CANDIDATE_KEY_PREFIX)) return false;
  if (event.payload.tradeDecision?.promptVersion !== SIMPLE_PIPELINE_PROMPT_VERSION) return false;
  if (event.ts > servedAt + 5 * 60_000) return false;
  return servedAt - event.ts <= PUBLIC_NEWS_DRIVEN_SYMBOL_MAX_AGE_MS;
}

function filterFreshNewsDrivenSymbolEvents(events: PublicTimelineEvent[], servedAt: number) {
  return events.filter(
    (event) =>
      event.payload.kind !== "pm_decision" || isFreshNewsDrivenSymbolEvent(event, servedAt),
  );
}

function isExecutableSymbolEvent(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return false;
  if (event.payload.candidateType !== "symbol" && event.payload.candidateType !== undefined) {
    return false;
  }
  if (typeof event.payload.executable === "boolean") return event.payload.executable;
  return resolveSymbolMapping(event.payload.symbol).execution.executable;
}

export function selectSymbolFloorRecordEvents(
  events: PublicTimelineEvent[],
  {
    locale,
    before,
    since,
    servedAt,
    limit = PUBLIC_SYMBOL_FLOOR_TARGET,
  }: {
    locale: Locale;
    before: number;
    since?: number;
    servedAt: number;
    limit?: number;
  },
) {
  const minTs = servedAt - MAX_PUBLIC_RESIDENT_FLOOR_WINDOW_MINUTES * 60_000;
  const bySymbol = new Map<string, PublicTimelineEvent>();

  for (const event of events) {
    if (event.payload.kind !== "pm_decision") continue;
    if (event.locale !== locale) continue;
    if (event.ts >= before || event.ts < minTs) continue;
    if (since !== undefined && event.ts <= since) continue;
    if (!isExecutableSymbolEvent(event)) continue;

    const symbol = event.payload.symbol.trim().replace(/^\$+/, "").toUpperCase();
    if (!symbol || symbol === "UNKNOWN") continue;
    const existing = bySymbol.get(symbol);
    if (
      !existing ||
      event.ts > existing.ts ||
      (event.ts === existing.ts && event.id < existing.id)
    ) {
      bySymbol.set(symbol, event);
    }
  }

  return Array.from(bySymbol.values()).sort(comparePublicTimelineEvents).slice(0, limit);
}

function symbolsNeedingRecordHydration(events: PublicTimelineEvent[]) {
  return Array.from(
    new Set(
      events.flatMap((event) => {
        if (event.payload.kind !== "pm_decision") return [];
        if (!shouldReplaceWithRecordEvent(event, event)) return [];
        return event.payload.symbol === "UNKNOWN" ? [] : [event.payload.symbol];
      }),
    ),
  );
}

function knownRecordHydrationSymbols() {
  return Object.keys(knownSymbolMappings());
}

async function readTargetedDecisionRecords(
  symbols: string[],
  locale: Locale,
): Promise<StrategyDecisionRecord[]> {
  if (symbols.length === 0) return [];
  const batches = await Promise.all(
    symbols.map((symbol) => readDecisionRecords(symbol, 20, locale).catch(() => [])),
  );
  return batches.flat();
}

export async function buildWatchTimelinePayload({
  mode,
  locale,
  before,
  since,
  limit,
  windowMinutes,
  servedAt = Date.now(),
}: WatchTimelinePayloadOptions): Promise<WatchTimelinePayload> {
  const stagingFixture = shouldUseStagingMockTimeline()
    ? getStagingMockTimeline(locale, servedAt)
    : null;
  const result =
    stagingFixture ?? (await getWatchHistory({ before, since, limit, windowMinutes, locale }));
  if (mode === "debug") {
    return {
      entries: result.entries,
      oldestTs: result.oldestTs,
      hasMore: result.hasMore,
      windowMinutes,
      locale,
      servedAt,
      nextPollMs: 30_000,
    };
  }

  const [decisionRecords, pmDecisionJobs] = stagingFixture
    ? [Array.from(stagingFixture.decisionRecordsById.values()), []]
    : await Promise.all([
        readAllDecisionRecords(500, locale),
        readPmDecisionJobs({ locale, limit: 100 }).catch(() => []),
      ]);
  const decisionRecordsById =
    stagingFixture?.decisionRecordsById ?? buildDecisionRecordIndex(decisionRecords);
  const projectedEvents = filterPublicTimelineEvents(result.entries, {
    mode: "public",
    importanceThreshold: "high",
    locale,
    decisionRecordsById,
  });
  const targetedRecords = stagingFixture
    ? []
    : await readTargetedDecisionRecords(
        Array.from(
          new Set([
            ...symbolsNeedingRecordHydration(projectedEvents),
            ...knownRecordHydrationSymbols(),
          ]),
        ),
        locale,
      );
  const decisionRecordsForBackfill = buildDecisionRecordIndex([
    ...Array.from(decisionRecordsById.values()),
    ...targetedRecords,
  ]);
  const cutoff = resolvePublicTimelineRecordCutoff(servedAt, windowMinutes);
  const allRecordEvents = Array.from(decisionRecordsForBackfill.values())
    .map(projectDecisionRecordToPublicEvent)
    .filter((event): event is PublicTimelineEvent => Boolean(event))
    .filter(
      (event) =>
        event.locale === locale && event.ts < before && (since === undefined || event.ts > since),
    );
  const recordEvents = allRecordEvents.filter((event) => event.ts >= cutoff);
  const residentFloorRecordEvents = selectResidentFloorRecordEvents(allRecordEvents, {
    locale,
    before,
    since,
    servedAt,
  });
  const symbolFloorRecordEvents = selectSymbolFloorRecordEvents(allRecordEvents, {
    locale,
    before,
    since,
    servedAt,
  });
  const events = mergeDecisionRecordBackfillEvents(
    filterFreshNewsDrivenSymbolEvents(projectedEvents.sort(comparePublicTimelineEvents), servedAt),
    filterFreshNewsDrivenSymbolEvents(
      [...recordEvents, ...residentFloorRecordEvents, ...symbolFloorRecordEvents].sort(
        comparePublicTimelineEvents,
      ),
      servedAt,
    ),
    limit,
  );
  const evidenceIds = Array.from(new Set(events.flatMap((event) => event.evidenceIds))).slice(
    0,
    MAX_EVIDENCE_MAP_ITEMS,
  );
  const evidenceMap = stagingFixture
    ? Object.fromEntries(
        evidenceIds.flatMap((evidenceId) =>
          stagingFixture.evidenceMap[evidenceId]
            ? [[evidenceId, stagingFixture.evidenceMap[evidenceId]]]
            : [],
        ),
      )
    : Object.fromEntries(
        (
          await Promise.all(
            evidenceIds.map(
              async (evidenceId) => [evidenceId, await getNewsEvidence(evidenceId)] as const,
            ),
          )
        ).flatMap(([evidenceId, evidence]) => (evidence ? [[evidenceId, evidence]] : [])),
      );

  return {
    events,
    evidenceMap,
    oldestTs:
      events.length > 0 ? (events[events.length - 1]?.ts ?? result.oldestTs) : result.oldestTs,
    hasMore: result.hasMore,
    windowMinutes,
    locale,
    servedAt,
    nextPollMs: resolveWatchTimelineNextPollMs(servedAt),
    residentStatus: deriveResidentPrewarmStatus({
      records: Array.from(decisionRecordsById.values()),
      jobs: pmDecisionJobs,
      now: servedAt,
    }),
  };
}
