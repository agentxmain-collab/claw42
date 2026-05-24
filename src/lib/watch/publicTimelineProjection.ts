import type {
  PublicDecisionRoundEntry,
  PublicDecisionStageTraceEntry,
  PublicTimelineEvent,
  PublicTimelineImportance,
  PublicTradeDecision,
} from "@/lib/watch/publicTimelineEvent";
import { PUBLIC_IMPORTANCE_ORDER } from "@/lib/watch/publicTimelineEvent";
import type { Locale } from "@/i18n/types";
import type { StrategyDecisionRecord } from "@/lib/team/strategyDecisionRecord";
import { calculateDecisionFreshnessStatus } from "@/lib/team/freshnessStatus";
import { resolveSymbolMapping } from "@/lib/team/symbolMapping";
import { isTeamMemberId, type TeamMemberId } from "@/lib/team/teamRegistry";
import {
  normalizeCandidateKey,
  normalizeCandidateType,
  type CandidateType,
} from "@/lib/watch/decisionCandidate";
import { LEGACY_WATCH_LOCALE, normalizeWatchLocale } from "@/lib/watch/locale";
import { comparePublicTimelineEvents } from "@/lib/watch/publicTimelineOrdering";
import {
  cleanPublicAnalysisSummary,
  cleanPublicDecisionText,
  containsPublicContentLeak,
} from "@/lib/watch/publicContentGuardrails";
import { hasCompletePublicDecisionStageTrace } from "@/lib/watch/publicPmDecisionDisplay";
import {
  mapTeamMemberToPublicDecisionAgent,
  type PublicDecisionAgentId,
} from "@/lib/watch/publicDecisionAgents";
import { normalizePublicDecisionStageTrace } from "@/lib/watch/publicDecisionStageContract";
import type { StreamEntry, WatchEntryMeta } from "@/modules/agent-watch/types";

export interface PublicTimelineProjectionOptions {
  mode: "public" | "debug";
  importanceThreshold?: PublicTimelineImportance;
  locale?: Locale;
  decisionRecordsById?: ReadonlyMap<string, StrategyDecisionRecord>;
}

export function buildDecisionRecordIndex(
  records: readonly StrategyDecisionRecord[],
): Map<string, StrategyDecisionRecord> {
  const index = new Map<string, StrategyDecisionRecord>();
  for (const record of records) {
    if (!index.has(record.id)) index.set(record.id, record);
  }
  return index;
}

export function publicStageTraceFromRecord(
  record: StrategyDecisionRecord | null,
  options: { hasRenderableTradeDecision: boolean; analysisOnlyCandidate?: boolean } = {
    hasRenderableTradeDecision: false,
  },
): PublicDecisionStageTraceEntry[] | undefined {
  if (!record?.stageTrace?.length) return undefined;
  return normalizePublicDecisionStageTrace(
    record.stageTrace.map((stage) => ({
      stageId: stage.stageId,
      status: stage.status,
      observedAt: stage.observedAt,
      ...(stage.memberIds?.length
        ? { agentIds: stage.memberIds.map(mapTeamMemberToPublicDecisionAgent) }
        : {}),
    })),
    options,
  );
}

function isAnalysisOnlyRecord(record: StrategyDecisionRecord | null) {
  return normalizeCandidateType(record?.candidate?.candidateType) !== "symbol";
}

function hasPublishableStageTrace(record: StrategyDecisionRecord | null | undefined) {
  return hasCompletePublicDecisionStageTrace(record?.stageTrace);
}

function hasHydratedPublishableStageTrace(record: StrategyDecisionRecord | null | undefined) {
  return Boolean(record?.stageTrace?.length) && hasPublishableStageTrace(record);
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

function normalizePublicSymbol(symbol: string | undefined | null) {
  const normalized = symbol?.trim().replace(/^\$+/, "").toUpperCase() ?? "";
  return /^[A-Z0-9]{2,12}$/.test(normalized) ? normalized : null;
}

function symbolFromRecordId(recordId: string | undefined | null) {
  const match = recordId?.match(/^pm:([A-Z0-9]{2,12}):/);
  return normalizePublicSymbol(match?.[1]);
}

function normalizePublicSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map(normalizePublicSymbol).filter(Boolean))) as string[];
}

export function normalizePublicTradeDecision(
  decision: StrategyDecisionRecord["tradeDecision"] | null | undefined,
): PublicTradeDecision | null {
  if (!decision) return null;
  if (containsPublicContentLeak(`${decision.riskNote}\n${decision.invalidatesIf}`)) return null;
  const { generatedBy: _generatedBy, ...publicDecision } = decision;
  void _generatedBy;
  return {
    ...publicDecision,
    symbol: normalizePublicSymbol(decision.symbol) ?? "UNKNOWN",
  };
}

function executableForRecord(record: StrategyDecisionRecord | null, symbol: string) {
  const rawExecutable = (record as { executable?: unknown } | null)?.executable;
  if (typeof rawExecutable === "boolean") return rawExecutable;
  if (typeof record?.candidate?.executable === "boolean") return record.candidate.executable;
  return resolveSymbolMapping(symbol).execution.executable;
}

function candidateMetaForRecord(record: StrategyDecisionRecord | null, symbol: string) {
  const rawRecord = record as
    | (StrategyDecisionRecord & {
        candidateType?: unknown;
        candidateKey?: unknown;
        displayTitle?: unknown;
      })
    | null;
  const candidateType = normalizeCandidateType(
    record?.candidate?.candidateType ?? rawRecord?.candidateType,
  );
  const candidateKey =
    normalizeCandidateKey(record?.candidate?.candidateKey ?? rawRecord?.candidateKey) ??
    (candidateType === "symbol" ? symbol : undefined);
  const displayTitle =
    normalizeDisplayTitle(record?.candidate?.displayTitle ?? rawRecord?.displayTitle) ??
    (candidateType === "symbol" ? `${symbol} 实时行情分析` : undefined);

  return {
    candidateType,
    ...(candidateKey ? { candidateKey } : {}),
    ...(displayTitle ? { displayTitle } : {}),
  } satisfies {
    candidateType: CandidateType;
    candidateKey?: string;
    displayTitle?: string;
  };
}

function normalizeDisplayTitle(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function uniqueEvidenceIds(ids: unknown[]) {
  return Array.from(
    new Set(
      ids
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim()),
    ),
  );
}

function marketSignalPayload(entry: StreamEntry): PublicTimelineEvent["payload"] | null {
  if (entry.kind === "focus_event") {
    return {
      kind: "market_signal",
      symbol: normalizePublicSymbol(entry.symbol) ?? "UNKNOWN",
      signalType: entry.signalType,
      severity: entry.severity,
      description: entry.description,
    };
  }
  if (entry.kind === "collective_event") {
    return {
      kind: "market_signal",
      symbol: normalizePublicSymbol(entry.symbols[0]) ?? "MARKET",
      signalType: entry.signalType,
      severity: "alert",
      description: entry.description,
    };
  }
  if (entry.kind === "conflict_event") {
    return {
      kind: "market_signal",
      symbol: normalizePublicSymbol(entry.symbol) ?? "UNKNOWN",
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
  options: { requireHydratedRecord?: boolean } = {},
): PublicTimelineEvent["payload"] | null {
  if (entry.kind !== "chat_thread") return null;
  const recordId = meta.recordId ?? entry.thread.strategy?.id ?? null;
  if (!recordId) return null;
  const indexedRecord = decisionRecord?.id === recordId ? decisionRecord : null;
  if (options.requireHydratedRecord) {
    if (!hasHydratedPublishableStageTrace(indexedRecord)) return null;
  } else if (!hasPublishableStageTrace(indexedRecord)) {
    return null;
  }
  const derived = publicDecisionProcessFromRecord(indexedRecord);
  const tradeDecision = normalizePublicTradeDecision(
    indexedRecord?.tradeDecision ?? meta.tradeDecision ?? null,
  );
  const symbol =
    normalizePublicSymbol(indexedRecord?.symbol) ??
    normalizePublicSymbol(tradeDecision?.symbol) ??
    symbolFromRecordId(recordId) ??
    "UNKNOWN";
  const analysisSummary = cleanPublicAnalysisSummary(indexedRecord?.analysisSummary);
  const candidateMeta = candidateMetaForRecord(indexedRecord, symbol);
  const executable = executableForRecord(indexedRecord, symbol);
  if (candidateMeta.candidateType === "symbol" && !executable) return null;

  return {
    kind: "pm_decision",
    recordId,
    symbol,
    ...candidateMeta,
    executable,
    freshnessStatus: calculateDecisionFreshnessStatus(entry.ts) ?? undefined,
    ...(analysisSummary ? { analysisSummary } : {}),
    tradeDecision,
    rationaleByAgent: derived.rationaleByAgent,
    citationsByAgent: derived.citationsByAgent,
    rounds: derived.rounds,
    stageTrace: publicStageTraceFromRecord(indexedRecord, {
      hasRenderableTradeDecision: Boolean(tradeDecision),
      analysisOnlyCandidate: isAnalysisOnlyRecord(indexedRecord),
    }),
    resolution: resolutionFromRecord(indexedRecord),
  };
}

export function projectDecisionRecordToPublicEvent(
  record: StrategyDecisionRecord,
): PublicTimelineEvent | null {
  const ts = Date.parse(record.createdAt);
  if (!Number.isFinite(ts)) return null;
  if (!hasPublishableStageTrace(record)) return null;

  const derived = publicDecisionProcessFromRecord(record);
  const tradeDecision = normalizePublicTradeDecision(record.tradeDecision);
  const symbol =
    normalizePublicSymbol(record.symbol) ??
    normalizePublicSymbol(tradeDecision?.symbol) ??
    symbolFromRecordId(record.id) ??
    "UNKNOWN";
  const analysisSummary = cleanPublicAnalysisSummary(record.analysisSummary, record.locale);
  const candidateMeta = candidateMetaForRecord(record, symbol);
  const executable = executableForRecord(record, symbol);
  if (candidateMeta.candidateType === "symbol" && !executable) return null;

  const payload: PublicTimelineEvent["payload"] = {
    kind: "pm_decision",
    recordId: record.id,
    symbol,
    ...candidateMeta,
    executable,
    freshnessStatus: calculateDecisionFreshnessStatus(record.createdAt) ?? undefined,
    ...(analysisSummary ? { analysisSummary } : {}),
    tradeDecision,
    rationaleByAgent: derived.rationaleByAgent,
    citationsByAgent: derived.citationsByAgent,
    rounds: derived.rounds,
    stageTrace: publicStageTraceFromRecord(record, {
      hasRenderableTradeDecision: Boolean(tradeDecision),
      analysisOnlyCandidate: isAnalysisOnlyRecord(record),
    }),
    resolution: resolutionFromRecord(record),
  };

  return {
    id: `pm-decision:${record.id}`,
    ts,
    visibility: "public",
    importance: "high",
    sourceTrigger: "pm_decision",
    evidenceIds: evidenceIdsForPayload(record.tradeDecision?.evidenceIds ?? [], payload),
    locale: normalizeWatchLocale(record.locale),
    payload,
  };
}

function resolutionFromRecord(record: StrategyDecisionRecord | null) {
  if (!record?.resolvedOutcome || !record.resolvedAt) return undefined;
  return {
    outcome: record.resolvedOutcome,
    resolvedAt: record.resolvedAt,
    ...(typeof record.resolvedPrice === "number" ? { observedPrice: record.resolvedPrice } : {}),
    ...(record.resolutionPriceSource ? { observedPriceSource: record.resolutionPriceSource } : {}),
    ...(record.resolutionReason ? { reason: record.resolutionReason } : {}),
  };
}

function publicRoundsForInput(
  input: StrategyDecisionRecord["analystInputs"][number],
): PublicDecisionRoundEntry[] {
  const memberId = String(input.memberId);
  if (!isTeamMemberId(memberId)) return [];
  const agentId = mapTeamMemberToPublicDecisionAgent(memberId);

  const sourceRounds = Array.isArray(input.rounds) ? input.rounds : [];
  if (sourceRounds.length > 0) {
    return sourceRounds
      .map<PublicDecisionRoundEntry | null>((round) => {
        const rationale = publicRationaleForMember(memberId, {
          rationale: round.rationale,
          oneLineSummary: round.oneLineSummary,
          detailedRationale: round.detailedRationale,
        });
        if (!rationale) return null;
        const oneLineSummary = publicSummaryForMember(memberId, round.oneLineSummary, rationale);
        const detailedRationale = publicDetailForMember(
          memberId,
          round.detailedRationale,
          rationale,
        );
        const evidenceIds = Array.isArray(round.evidenceIds)
          ? round.evidenceIds.filter(Boolean)
          : [];
        return {
          round: Number.isFinite(round.round) && round.round > 0 ? Math.round(round.round) : 1,
          agentId,
          direction: round.direction,
          confidence: round.confidence,
          rationale,
          oneLineSummary: oneLineSummary ?? summaryForRound(undefined, rationale),
          detailedRationale: detailedRationale ?? rationale,
          dataStatus: round.dataStatus ?? "ok",
          ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
          ...(round.observedAt ? { observedAt: round.observedAt } : {}),
        };
      })
      .filter((round): round is PublicDecisionRoundEntry => Boolean(round));
  }

  const rationale = publicRationaleForMember(memberId, {
    rationale: input.rationale,
    oneLineSummary: input.oneLineSummary,
    detailedRationale: input.detailedRationale,
  });
  if (!rationale) return [];
  return [
    {
      round: 1,
      agentId,
      direction: input.direction,
      confidence: input.confidence,
      rationale,
      oneLineSummary: publicSummaryForMember(memberId, input.oneLineSummary, rationale),
      detailedRationale: publicDetailForMember(memberId, input.detailedRationale, rationale),
      dataStatus: input.dataStatus ?? "ok",
      ...(Array.isArray(input.evidenceIds) && input.evidenceIds.length > 0
        ? { evidenceIds: input.evidenceIds.filter(Boolean) }
        : {}),
    },
  ];
}

function publicRationaleForMember(
  memberId: TeamMemberId,
  input: {
    rationale?: string;
    oneLineSummary?: string;
    detailedRationale?: string;
  },
) {
  if (memberId === "pm") {
    return (
      cleanPublicAnalysisSummary(input.oneLineSummary) ??
      cleanPublicAnalysisSummary(input.rationale) ??
      cleanPublicAnalysisSummary(input.detailedRationale)
    );
  }

  return cleanPublicDecisionText(typeof input.rationale === "string" ? input.rationale.trim() : "");
}

function publicSummaryForMember(
  memberId: TeamMemberId,
  summary: string | undefined,
  rationale: string,
) {
  if (memberId === "pm") return rationale;
  return (
    cleanPublicDecisionText(summaryForRound(summary, rationale)) ??
    summaryForRound(undefined, rationale)
  );
}

function publicDetailForMember(
  memberId: TeamMemberId,
  detail: string | undefined,
  rationale: string,
) {
  if (memberId === "pm") return rationale;
  return cleanPublicDecisionText(detailForRound(detail, rationale)) ?? rationale;
}

function summaryForRound(summary: string | undefined, rationale: string) {
  const cleaned = summary?.trim();
  if (cleaned) return cleaned;
  const fallback = rationale.trim().replace(/\s+/g, " ");
  return fallback.length > 80 ? `${fallback.slice(0, 79).trim()}…` : fallback;
}

function detailForRound(detail: string | undefined, rationale: string) {
  return detail?.trim() || rationale.trim();
}

export function publicDecisionProcessFromRecord(record: StrategyDecisionRecord | null): {
  rationaleByAgent: Partial<Record<PublicDecisionAgentId, string>>;
  citationsByAgent: Partial<Record<PublicDecisionAgentId, string[]>>;
  rounds?: PublicDecisionRoundEntry[];
} {
  const rationaleByAgent: Partial<Record<PublicDecisionAgentId, string>> = {};
  const citationsByAgent: Partial<Record<PublicDecisionAgentId, string[]>> = {};
  const rounds: PublicDecisionRoundEntry[] = [];
  if (!record) return { rationaleByAgent, citationsByAgent };

  const analystInputs = Array.isArray(record.analystInputs) ? record.analystInputs : [];
  for (const input of analystInputs) {
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

    const inputRounds = publicRoundsForInput(input);
    rounds.push(...inputRounds);
    const agentId = mapTeamMemberToPublicDecisionAgent(memberId);
    const latestRound = inputRounds.reduce<PublicDecisionRoundEntry | undefined>(
      (latest, current) => (!latest || current.round >= latest.round ? current : latest),
      undefined,
    );
    const rationale = latestRound?.rationale ?? "";
    if (rationale) rationaleByAgent[agentId] = rationale;
    const evidenceIds = latestRound?.evidenceIds?.length ? latestRound.evidenceIds : [];
    if (evidenceIds.length > 0) citationsByAgent[agentId] = evidenceIds;
  }

  return {
    rationaleByAgent,
    citationsByAgent,
    ...(rounds.length > 0 ? { rounds } : {}),
  };
}

function evidenceIdsForPayload(metaEvidenceIds: string[], payload: PublicTimelineEvent["payload"]) {
  if (payload.kind === "news") {
    return uniqueEvidenceIds([...metaEvidenceIds, payload.evidenceId]);
  }
  if (payload.kind !== "pm_decision") {
    return uniqueEvidenceIds(metaEvidenceIds);
  }

  return uniqueEvidenceIds([
    ...metaEvidenceIds,
    ...Object.values(payload.citationsByAgent ?? {}).flatMap((ids) => ids ?? []),
    ...Object.values(payload.citationsByMember ?? {}).flatMap((ids) => ids ?? []),
    ...(payload.rounds ?? []).flatMap((round) => round.evidenceIds ?? []),
    ...(payload.tradeDecision?.evidenceIds ?? []),
  ]);
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
      symbols: normalizePublicSymbols(entry.debate.newsCurrencies),
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
      { requireHydratedRecord: Boolean(options.decisionRecordsById) },
    );
  }

  if (!payload) return null;

  return {
    id: entry.id,
    ts: entry.ts,
    visibility: meta.visibility,
    importance: meta.importance,
    sourceTrigger: meta.sourceTrigger,
    evidenceIds: evidenceIdsForPayload(meta.evidenceIds, payload),
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
    .sort(comparePublicTimelineEvents);
}
