import type { Locale } from "@/i18n/types";
import {
  buildWatchTimelinePayload,
  type PublicWatchTimelinePayload,
} from "@/lib/watch/publicTimelinePayload";
import type {
  PublicDecisionRoundEntry,
  PublicTimelineEvent,
} from "@/lib/watch/publicTimelineEvent";

export type SymbolSnapshotStrength = "low" | "medium" | "high" | null;

export interface SymbolSnapshot {
  symbol: string;
  summary: string;
  signal_strength: SymbolSnapshotStrength;
  updated_at: string;
  lang: string;
}

export interface PublicSymbolSnapshotOptions {
  now?: number;
  windowMinutes?: number;
  limit?: number;
  payload?: PublicWatchTimelinePayload;
}

export async function getPublicSymbolSnapshot(
  symbol: string,
  lang: Locale,
  options: PublicSymbolSnapshotOptions = {},
): Promise<SymbolSnapshot | null> {
  const normalizedSymbol = normalizeSnapshotSymbol(symbol);
  if (!normalizedSymbol) return null;

  const now = options.now ?? Date.now();
  const payload =
    options.payload ??
    ((await buildWatchTimelinePayload({
      mode: "public",
      locale: lang,
      before: now + 1,
      limit: options.limit ?? 100,
      windowMinutes: options.windowMinutes ?? 24 * 60,
      servedAt: now,
    })) as PublicWatchTimelinePayload);

  const event = payload.events.find(
    (item: PublicTimelineEvent) =>
      item.payload.kind === "pm_decision" && item.payload.symbol.toUpperCase() === normalizedSymbol,
  );
  if (!event || event.payload.kind !== "pm_decision") return null;

  const summary = buildSnapshotSummary(event);
  if (!summary) return null;

  return {
    symbol: normalizedSymbol,
    summary,
    signal_strength: deriveSignalStrength(event.payload.rounds ?? []),
    updated_at: new Date(event.ts).toISOString(),
    lang,
  };
}

export function normalizeSnapshotSymbol(symbol: string) {
  const normalized = symbol.replace(/^\$+/, "").trim().toUpperCase();
  return /^[A-Z0-9]{2,16}$/.test(normalized) ? normalized : null;
}

function buildSnapshotSummary(event: PublicTimelineEvent) {
  if (event.payload.kind !== "pm_decision") return null;
  if (event.payload.analysisSummary) return event.payload.analysisSummary.slice(0, 360);
  const latestRound = [...(event.payload.rounds ?? [])]
    .filter((round) => round.oneLineSummary || round.rationale)
    .sort((left, right) => right.round - left.round)[0];
  if (latestRound?.oneLineSummary) return latestRound.oneLineSummary.slice(0, 360);
  if (latestRound?.rationale) return latestRound.rationale.slice(0, 360);
  if (event.payload.tradeDecision) {
    return `${event.payload.symbol} ${event.payload.tradeDecision.direction}`.slice(0, 360);
  }
  return null;
}

function deriveSignalStrength(rounds: PublicDecisionRoundEntry[]): SymbolSnapshotStrength {
  const confidences = rounds.flatMap((round) =>
    typeof round.confidence === "number" && Number.isFinite(round.confidence)
      ? [round.confidence]
      : [],
  );
  if (confidences.length === 0) return null;
  const maxConfidence = Math.max(...confidences);
  if (maxConfidence >= 0.7) return "high";
  if (maxConfidence >= 0.45) return "medium";
  return "low";
}
