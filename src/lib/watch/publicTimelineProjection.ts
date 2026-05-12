import type {
  PublicTimelineEvent,
  PublicTimelineImportance,
} from "@/lib/watch/publicTimelineEvent";
import { PUBLIC_IMPORTANCE_ORDER } from "@/lib/watch/publicTimelineEvent";
import type { Locale } from "@/i18n/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { isTeamMemberId, type TeamMemberId } from "@/lib/team/teamRegistry";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import type { StreamEntry, WatchEntryMeta } from "@/modules/agent-watch/types";

export interface PublicTimelineProjectionOptions {
  mode: "public" | "debug";
  importanceThreshold?: PublicTimelineImportance;
  locale?: Locale;
  decisionRecordsById?: ReadonlyMap<string, StrategyDecisionRecord>;
}

function inferredMeta(entry: StreamEntry): WatchEntryMeta {
  if (entry.meta) return normalizeMeta(entry.meta);

  if (
    entry.kind === "focus_event" ||
    entry.kind === "collective_event" ||
    entry.kind === "conflict_event"
  ) {
    return {
      visibility: "public",
      importance: "high",
      sourceTrigger: "market_signal",
      evidenceIds: [],
      locale: LEGACY_WATCH_LOCALE,
    };
  }

  if (entry.kind === "news_debate") {
    return {
      visibility: "debug",
      importance: "medium",
      sourceTrigger: "news",
      evidenceIds: [],
      locale: LEGACY_WATCH_LOCALE,
    };
  }

  return {
    visibility: "debug",
    importance: "low",
    sourceTrigger: "fallback",
    evidenceIds: [],
    locale: LEGACY_WATCH_LOCALE,
  };
}

function normalizeMeta(meta: WatchEntryMeta): WatchEntryMeta {
  return {
    visibility: meta.visibility === "public" ? "public" : "debug",
    importance: meta.importance,
    sourceTrigger: meta.sourceTrigger,
    evidenceIds: Array.isArray(meta.evidenceIds) ? meta.evidenceIds.filter(Boolean) : [],
    locale: normalizeWatchLocale(meta.locale),
    recordId: meta.recordId,
    tradeDecision: meta.tradeDecision ?? null,
  };
}

function passesImportance(
  importance: PublicTimelineImportance,
  threshold: PublicTimelineImportance,
) {
  return PUBLIC_IMPORTANCE_ORDER[importance] >= PUBLIC_IMPORTANCE_ORDER[threshold];
}

function marketSignalPayload(entry: StreamEntry): PublicTimelineEvent["payload"] | null {
  if (entry.kind === "focus_event") {
    return {
      kind: "market_signal",
      symbol: entry.symbol,
      signalType: entry.signalType,
      severity: entry.severity,
      description: entry.description,
    };
  }
  if (entry.kind === "collective_event") {
    return {
      kind: "market_signal",
      symbol: entry.symbols[0] ?? "MARKET",
      signalType: entry.signalType,
      severity: "alert",
      description: entry.description,
    };
  }
  if (entry.kind === "conflict_event") {
    return {
      kind: "market_signal",
      symbol: entry.symbol,
      signalType: "conflict",
      severity: "alert",
      description: entry.description,
    };
  }
  return null;
}

function pmDecisionPayload(
  entry: StreamEntry,
  meta: WatchEntryMeta,
  decisionRecord?: StrategyDecisionRecord,
): PublicTimelineEvent["payload"] | null {
  if (entry.kind !== "chat_thread") return null;
  const recordId = meta.recordId ?? entry.thread.strategy?.id ?? null;
  if (!recordId) return null;
  const derived = derivePmDecisionProcess(decisionRecord?.id === recordId ? decisionRecord : null);
  return {
    kind: "pm_decision",
    recordId,
    tradeDecision: meta.tradeDecision ?? decisionRecord?.tradeDecision ?? null,
    rationaleByMember: derived.rationaleByMember,
    citationsByMember: derived.citationsByMember,
  };
}

function derivePmDecisionProcess(record: StrategyDecisionRecord | null): {
  rationaleByMember: Partial<Record<TeamMemberId, string>>;
  citationsByMember: Partial<Record<TeamMemberId, string[]>>;
} {
  const rationaleByMember: Partial<Record<TeamMemberId, string>> = {};
  const citationsByMember: Partial<Record<TeamMemberId, string[]>> = {};
  if (!record) return { rationaleByMember, citationsByMember };

  for (const input of record.analystInputs) {
    const memberId = String(input.memberId);
    if (!isTeamMemberId(memberId)) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[claw42] skipped unknown PM decision member", {
          recordId: record.id,
          memberId,
        });
      }
      continue;
    }

    const rationale = input.rationale.trim();
    if (rationale) rationaleByMember[memberId] = rationale;
    const evidenceIds = input.evidenceIds.filter(Boolean);
    if (evidenceIds.length > 0) citationsByMember[memberId] = evidenceIds;
  }

  return { rationaleByMember, citationsByMember };
}

function newsPayload(
  entry: StreamEntry,
  meta: WatchEntryMeta,
): PublicTimelineEvent["payload"] | null {
  const evidenceId = meta.evidenceIds[0];
  if (!evidenceId) return null;
  if (entry.kind === "news_debate") {
    return {
      kind: "news",
      evidenceId,
      symbols: entry.debate.newsCurrencies,
    };
  }
  return {
    kind: "news",
    evidenceId,
    symbols: [],
  };
}

export function projectStreamEntryToPublic(
  entry: StreamEntry,
  options: PublicTimelineProjectionOptions = { mode: "public" },
): PublicTimelineEvent | null {
  const meta = inferredMeta(entry);
  const threshold = options.importanceThreshold ?? "high";
  const locale = normalizeWatchLocale(options.locale);

  if (options.mode === "public") {
    if (meta.visibility !== "public") return null;
    if (!passesImportance(meta.importance, threshold)) return null;
    if (meta.locale !== locale) return null;
  }

  if (
    entry.kind === "agent_message" ||
    entry.kind === "watch_update" ||
    entry.kind === "agent_discussion"
  ) {
    return null;
  }

  let payload: PublicTimelineEvent["payload"] | null = null;
  if (meta.sourceTrigger === "market_signal") payload = marketSignalPayload(entry);
  if (meta.sourceTrigger === "news") payload = newsPayload(entry, meta);
  if (meta.sourceTrigger === "pm_decision") {
    const recordId =
      meta.recordId ?? (entry.kind === "chat_thread" ? entry.thread.strategy?.id : null);
    payload = pmDecisionPayload(
      entry,
      meta,
      recordId ? options.decisionRecordsById?.get(recordId) : undefined,
    );
  }

  if (!payload) return null;

  return {
    id: entry.id,
    ts: entry.ts,
    visibility: meta.visibility,
    importance: meta.importance,
    sourceTrigger: meta.sourceTrigger,
    evidenceIds: meta.evidenceIds,
    locale: meta.locale,
    payload,
  };
}

export function filterPublicTimelineEvents(
  entries: StreamEntry[],
  options: PublicTimelineProjectionOptions,
): PublicTimelineEvent[] {
  return entries
    .map((entry) => projectStreamEntryToPublic(entry, options))
    .filter((event): event is PublicTimelineEvent => Boolean(event))
    .sort((a, b) => b.ts - a.ts);
}
