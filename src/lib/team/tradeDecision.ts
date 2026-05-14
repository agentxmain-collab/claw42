import { isTeamMemberId, type TeamMemberId } from "@/lib/team/teamRegistry";

export type TradeDirection = "long" | "short" | "wait";
export type EntryType = "market" | "limit" | "breakout" | "pullback" | "wait";
export type Severity = "low" | "medium" | "high";

export interface TradeDecision {
  id: string;
  schemaVersion: 1;
  symbol: string;
  generatedBy: TeamMemberId;
  generatedAt: string;
  direction: TradeDirection;
  entryType: EntryType;
  entryPrice: number | null;
  entryRange: { low: number; high: number } | null;
  stopLoss: number | null;
  takeProfit: number[];
  positionSizing: number;
  timeHorizon: "intraday" | "swing" | "position";
  rating: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  evidenceIds: string[];
  riskNote: string;
  invalidatesIf: string;
  promptVersion: string;
  modelProvider: string;
  severity: Severity;
}

export type ValidationResult =
  | { valid: true; decision: TradeDecision }
  | { valid: false; errors: string[]; rawDecision: unknown };

const DIRECTIONS = new Set<TradeDirection>(["long", "short", "wait"]);
const ENTRY_TYPES = new Set<EntryType>(["market", "limit", "breakout", "pullback", "wait"]);
const TIME_HORIZONS = new Set<TradeDecision["timeHorizon"]>(["intraday", "swing", "position"]);
const SEVERITIES = new Set<Severity>(["low", "medium", "high"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullOrFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function validateEntryRange(value: unknown, errors: string[]) {
  if (value === null) return value;
  if (!isObject(value)) {
    errors.push("entryRange must be null or { low, high }");
    return null;
  }
  const low = value.low;
  const high = value.high;
  if (!isFiniteNumber(low) || !isFiniteNumber(high)) {
    errors.push("entryRange.low and entryRange.high must be finite numbers");
    return null;
  }
  if (low > high) {
    errors.push("entryRange.low must be <= entryRange.high");
    return null;
  }
  return { low, high };
}

function validateTakeProfit(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("takeProfit must be an array");
    return [];
  }
  const takeProfit = value.filter(isFiniteNumber);
  if (takeProfit.length !== value.length)
    errors.push("takeProfit must contain only finite numbers");
  return takeProfit;
}

function validateEvidenceIds(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("evidenceIds must be an array");
    return [];
  }
  const evidenceIds = value.filter((item): item is string => typeof item === "string");
  if (evidenceIds.length !== value.length) errors.push("evidenceIds must contain only strings");
  return evidenceIds;
}

function withinCurrentPriceBand(entryPrice: number, currentPrice: number) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;
  return Math.abs(entryPrice - currentPrice) / currentPrice <= 0.15;
}

function isStrictlyIncreasing(values: number[]) {
  return values.every((value, index) => index === 0 || value > values[index - 1]!);
}

function isStrictlyDecreasing(values: number[]) {
  return values.every((value, index) => index === 0 || value < values[index - 1]!);
}

export function validateTradeDecision(raw: unknown, currentPrice: number): ValidationResult {
  const errors: string[] = [];
  if (!isObject(raw))
    return { valid: false, errors: ["decision must be an object"], rawDecision: raw };

  const direction = raw.direction;
  const entryType = raw.entryType;
  const entryPrice = raw.entryPrice;
  const stopLoss = raw.stopLoss;
  const rating = raw.rating;
  const takeProfit = validateTakeProfit(raw.takeProfit, errors);
  const entryRange = validateEntryRange(raw.entryRange, errors);
  const evidenceIds = validateEvidenceIds(raw.evidenceIds, errors);

  if (!isNonEmptyString(raw.id)) errors.push("id is required");
  if (raw.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!isNonEmptyString(raw.symbol)) errors.push("symbol is required");
  if (!isNonEmptyString(raw.generatedBy) || !isTeamMemberId(raw.generatedBy)) {
    errors.push("generatedBy must be a valid TeamMemberId");
  }
  if (!isNonEmptyString(raw.generatedAt) || Number.isNaN(Date.parse(raw.generatedAt))) {
    errors.push("generatedAt must be an ISO timestamp");
  }
  if (typeof direction !== "string" || !DIRECTIONS.has(direction as TradeDirection)) {
    errors.push("direction must be long, short, or wait");
  }
  if (typeof entryType !== "string" || !ENTRY_TYPES.has(entryType as EntryType)) {
    errors.push("entryType must be market, limit, breakout, pullback, or wait");
  }
  if (!isNullOrFiniteNumber(entryPrice)) errors.push("entryPrice must be a finite number or null");
  if (!isNullOrFiniteNumber(stopLoss)) errors.push("stopLoss must be a finite number or null");
  if (!isFiniteNumber(raw.positionSizing) || raw.positionSizing < 0 || raw.positionSizing > 0.5) {
    errors.push("positionSizing must be between 0 and 0.5");
  }
  if (typeof raw.timeHorizon !== "string" || !TIME_HORIZONS.has(raw.timeHorizon as never)) {
    errors.push("timeHorizon must be intraday, swing, or position");
  }
  if (!isFiniteNumber(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push("rating must be an integer from 1 to 5");
  }
  if (!isFiniteNumber(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }
  if (!isNonEmptyString(raw.riskNote)) errors.push("riskNote is required");
  if (!isNonEmptyString(raw.invalidatesIf)) errors.push("invalidatesIf is required");
  if (!isNonEmptyString(raw.promptVersion)) errors.push("promptVersion is required");
  if (!isNonEmptyString(raw.modelProvider)) errors.push("modelProvider is required");
  if (typeof raw.severity !== "string" || !SEVERITIES.has(raw.severity as Severity)) {
    errors.push("severity must be low, medium, or high");
  }

  if (direction === "wait") {
    if (entryType !== "wait") errors.push("wait decisions must use entryType=wait");
    if (entryPrice !== null) errors.push("wait decisions must have entryPrice=null");
    if (entryRange !== null) errors.push("wait decisions must have entryRange=null");
    if (stopLoss !== null) errors.push("wait decisions must have stopLoss=null");
    if (takeProfit.length > 0) errors.push("wait decisions must have empty takeProfit");
  }

  if (direction === "long" || direction === "short") {
    if (!isFiniteNumber(entryPrice)) errors.push(`${direction} decisions require entryPrice`);
    if (!isFiniteNumber(stopLoss)) errors.push(`${direction} decisions require stopLoss`);
    if (takeProfit.length === 0)
      errors.push(`${direction} decisions require at least one takeProfit`);

    if (isFiniteNumber(entryPrice)) {
      if (!withinCurrentPriceBand(entryPrice, currentPrice)) {
        errors.push("entryPrice must be within currentPrice +/-15%");
      }
      if (entryRange && (entryPrice < entryRange.low || entryPrice > entryRange.high)) {
        errors.push("entryPrice must sit inside entryRange");
      }
    }

    if (isFiniteNumber(entryPrice) && isFiniteNumber(stopLoss)) {
      if (direction === "long" && stopLoss >= entryPrice) {
        errors.push("long stopLoss must be below entryPrice");
      }
      if (direction === "short" && stopLoss <= entryPrice) {
        errors.push("short stopLoss must be above entryPrice");
      }
    }

    if (isFiniteNumber(entryPrice)) {
      const invalidTargets =
        direction === "long"
          ? takeProfit.filter((target) => target <= entryPrice)
          : takeProfit.filter((target) => target >= entryPrice);
      if (invalidTargets.length > 0) {
        errors.push(`${direction} takeProfit targets must be on the profitable side of entryPrice`);
      }
    }

    if (direction === "long" && !isStrictlyIncreasing(takeProfit)) {
      errors.push("long takeProfit must be strictly increasing");
    }
    if (direction === "short" && !isStrictlyDecreasing(takeProfit)) {
      errors.push("short takeProfit must be strictly decreasing");
    }
  }

  if (errors.length > 0) return { valid: false, errors, rawDecision: raw };

  return {
    valid: true,
    decision: {
      id: raw.id as string,
      schemaVersion: 1,
      symbol: (raw.symbol as string).trim().replace(/^\$+/, "").toUpperCase(),
      generatedBy: raw.generatedBy as TeamMemberId,
      generatedAt: raw.generatedAt as string,
      direction: direction as TradeDirection,
      entryType: entryType as EntryType,
      entryPrice: entryPrice as number | null,
      entryRange,
      stopLoss: stopLoss as number | null,
      takeProfit,
      positionSizing: raw.positionSizing as number,
      timeHorizon: raw.timeHorizon as TradeDecision["timeHorizon"],
      rating: rating as TradeDecision["rating"],
      confidence: raw.confidence as number,
      evidenceIds,
      riskNote: raw.riskNote as string,
      invalidatesIf: raw.invalidatesIf as string,
      promptVersion: raw.promptVersion as string,
      modelProvider: raw.modelProvider as string,
      severity: raw.severity as Severity,
    },
  };
}
