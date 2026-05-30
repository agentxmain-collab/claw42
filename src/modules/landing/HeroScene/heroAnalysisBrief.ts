import type { Locale } from "@/i18n/types";
import type { NewsEvidence } from "@/lib/news/newsEvidence";
import type { PublicTimelineEvent, PublicTradeDecision } from "@/lib/watch/publicTimelineEvent";

export interface HeroAnalysisBrief {
  line: string;
  recordId: string;
  source: "watch-timeline-analysis-summary";
  symbol: string;
  summary: string;
}

interface BuildHeroAnalysisBriefOptions {
  events: PublicTimelineEvent[];
  evidenceMap?: Record<string, NewsEvidence>;
  locale: Locale;
}

const COMPLETE_BRIEF_MAX_SOURCE_COUNT = 4;

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeSymbol(value: string | null | undefined) {
  return value?.replace(/^\$+/, "").trim().toUpperCase() ?? "";
}

function displaySymbol(value: string) {
  const normalized = normalizeSymbol(value);
  return normalized ? `$${normalized}` : "";
}

function directionToken(tradeDecision: PublicTradeDecision | null | undefined) {
  if (!tradeDecision || tradeDecision.direction === "wait") return "";
  const direction = tradeDecision.direction.toUpperCase();
  const positionSizing = tradeDecision.positionSizing;
  if (!Number.isFinite(positionSizing) || positionSizing <= 0) return direction;
  return `${direction} ${Math.round(positionSizing * 100)}%`;
}

function candidateText(values: Array<string | null | undefined>) {
  return values.map(normalizeWhitespace).find(Boolean) ?? "";
}

function summaryFromRounds(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return "";
  const rounds = event.payload.rounds ?? [];
  for (const round of rounds.slice(0, COMPLETE_BRIEF_MAX_SOURCE_COUNT)) {
    const summary = candidateText([round.oneLineSummary, round.detailedRationale, round.rationale]);
    if (summary) return summary;
  }
  return "";
}

function summaryFromEvidence(
  event: PublicTimelineEvent,
  evidenceMap: Record<string, NewsEvidence> | undefined,
) {
  if (!evidenceMap) return "";
  for (const evidenceId of event.evidenceIds.slice(0, COMPLETE_BRIEF_MAX_SOURCE_COUNT)) {
    const evidence = evidenceMap[evidenceId];
    const summary = candidateText([evidence?.summary, evidence?.title]);
    if (summary) return summary;
  }
  return "";
}

function summaryFromDecision(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return "";
  const agentRationales = Object.values(event.payload.rationaleByAgent ?? {});
  const legacyRationales = Object.values(event.payload.rationaleByMember ?? {});
  return candidateText([event.payload.analysisSummary, ...agentRationales, ...legacyRationales]);
}

function completeHeroLine(
  symbol: string,
  summary: string,
  tradeDecision?: PublicTradeDecision | null,
) {
  const compactSummary = normalizeWhitespace(summary);
  const prefix = [displaySymbol(symbol), directionToken(tradeDecision)].filter(Boolean).join(" ");
  return prefix ? `${prefix}: ${compactSummary}` : compactSummary;
}

function publicDecisionEvents(events: PublicTimelineEvent[], locale: Locale) {
  const publicEvents = events.filter(
    (event) => event.visibility === "public" && event.payload.kind === "pm_decision",
  );
  const localeMatched = publicEvents.filter((event) => event.locale === locale);
  return localeMatched.length ? localeMatched : publicEvents;
}

export function buildHeroAnalysisBriefFromEvents({
  events,
  evidenceMap,
  locale,
}: BuildHeroAnalysisBriefOptions): HeroAnalysisBrief | null {
  for (const event of publicDecisionEvents(events, locale)) {
    if (event.payload.kind !== "pm_decision") continue;
    const summary =
      summaryFromDecision(event) ||
      summaryFromRounds(event) ||
      summaryFromEvidence(event, evidenceMap);
    if (!summary) continue;

    const symbol = normalizeSymbol(event.payload.symbol);
    const line = completeHeroLine(symbol, summary, event.payload.tradeDecision);
    if (!line) continue;

    return {
      line,
      recordId: event.payload.recordId,
      source: "watch-timeline-analysis-summary",
      symbol,
      summary: normalizeWhitespace(summary),
    };
  }

  return null;
}
