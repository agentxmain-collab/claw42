import type { LocalizedText, MarketDirection } from "@/types/common";
import type { ImpactLevel } from "@/types/signal";
import type { StructuredFields } from "@/lib/signal-engine/providers/types";

const directions = new Set<MarketDirection>(["bullish", "bearish", "neutral"]);
const impactLevels = new Set<ImpactLevel>(["critical", "high", "medium", "low"]);

export function normalizeStructuredFields(
  value: unknown,
  fallback: StructuredFields,
): StructuredFields {
  const input = isRecord(value) ? value : {};

  return {
    whyItMatters: normalizeLocalizedText(
      readAlias(input, "whyItMatters", "why_it_matters"),
      fallback.whyItMatters,
    ),
    marketContext: normalizeLocalizedText(
      readAlias(input, "marketContext", "market_context"),
      fallback.marketContext,
    ),
    watchPoints: normalizeLocalizedTextList(
      readAlias(input, "watchPoints", "watch_points"),
      fallback.watchPoints,
    ),
    direction: normalizeDirection(input.direction, fallback.direction),
    confidence: normalizeConfidence(input.confidence, fallback.confidence),
    impactLevel: normalizeImpactLevel(
      readAlias(input, "impactLevel", "impact_level"),
      fallback.impactLevel,
    ),
    riskNotes: normalizeLocalizedTextList(
      readAlias(input, "riskNotes", "risk_notes"),
      fallback.riskNotes,
    ),
  };
}

function readAlias(input: Record<string, unknown>, preferred: string, alias: string) {
  return input[preferred] ?? input[alias];
}

function normalizeLocalizedText(value: unknown, fallback: LocalizedText): LocalizedText {
  if (!isRecord(value)) return fallback;
  const zh = normalizeText(value.zh);
  const en = normalizeText(value.en);
  if (!zh || !en) return fallback;
  return { zh, en };
}

function normalizeLocalizedTextList(value: unknown, fallback: LocalizedText[]): LocalizedText[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => normalizeLocalizedTextOrNull(item))
    .filter((item): item is LocalizedText => item !== null);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeLocalizedTextOrNull(value: unknown): LocalizedText | null {
  if (!isRecord(value)) return null;
  const zh = normalizeText(value.zh);
  const en = normalizeText(value.en);
  if (!zh || !en) return null;
  return { zh, en };
}

function normalizeDirection(
  value: unknown,
  fallback: MarketDirection | null,
): MarketDirection | null {
  if (value === null) return null;
  return typeof value === "string" && directions.has(value as MarketDirection)
    ? (value as MarketDirection)
    : fallback;
}

function normalizeConfidence(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeImpactLevel(value: unknown, fallback: ImpactLevel): ImpactLevel {
  return typeof value === "string" && impactLevels.has(value as ImpactLevel)
    ? (value as ImpactLevel)
    : fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
