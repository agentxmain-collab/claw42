export const PUBLIC_BOARD_HARDSTOP_MONTHLY_COMMAND_LIMIT = 475_635;

interface PublicBoardBudgetCheckInput {
  route: string;
  estimatedCommands: number;
  now?: number;
}

interface PublicBoardBudgetCheckAllowed {
  allowed: true;
  monthKey: string;
  estimatedCommandsUsed: number;
  remainingEstimatedCommands: number;
}

interface PublicBoardBudgetCheckDenied {
  allowed: false;
  monthKey: string;
  estimatedCommandsUsed: number;
  remainingEstimatedCommands: number;
  reason: "public_board_kv_budget_exhausted" | "public_board_kv_budget_forced";
}

type PublicBoardBudgetCheckResult = PublicBoardBudgetCheckAllowed | PublicBoardBudgetCheckDenied;

const lastGoodPayloads = new Map<string, unknown>();

let currentMonthKey = monthKeyFor(Date.now());
let estimatedCommandsUsed = 0;
let forceTrip = false;

export function checkPublicBoardKvBudget({
  route,
  estimatedCommands,
  now = Date.now(),
}: PublicBoardBudgetCheckInput): PublicBoardBudgetCheckResult {
  void route;
  const monthKey = monthKeyFor(now);
  if (monthKey !== currentMonthKey) {
    currentMonthKey = monthKey;
    estimatedCommandsUsed = 0;
    forceTrip = false;
  }

  const normalizedEstimate = Math.max(0, Math.ceil(estimatedCommands));
  const remaining = Math.max(
    0,
    PUBLIC_BOARD_HARDSTOP_MONTHLY_COMMAND_LIMIT - estimatedCommandsUsed,
  );
  if (forceTrip) {
    return {
      allowed: false,
      monthKey,
      estimatedCommandsUsed,
      remainingEstimatedCommands: remaining,
      reason: "public_board_kv_budget_forced",
    };
  }
  if (normalizedEstimate > remaining) {
    return {
      allowed: false,
      monthKey,
      estimatedCommandsUsed,
      remainingEstimatedCommands: remaining,
      reason: "public_board_kv_budget_exhausted",
    };
  }

  estimatedCommandsUsed += normalizedEstimate;
  return {
    allowed: true,
    monthKey,
    estimatedCommandsUsed,
    remainingEstimatedCommands: Math.max(
      0,
      PUBLIC_BOARD_HARDSTOP_MONTHLY_COMMAND_LIMIT - estimatedCommandsUsed,
    ),
  };
}

export function rememberPublicBoardLastGood(key: string, payload: unknown) {
  lastGoodPayloads.set(key, payload);
}

export function readPublicBoardLastGood<T>(key: string): T | null {
  return (lastGoodPayloads.get(key) as T | undefined) ?? null;
}

function monthKeyFor(now: number) {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const __publicBoardKvBudgetGuardTestUtils = {
  reset(now = Date.now()) {
    currentMonthKey = monthKeyFor(now);
    estimatedCommandsUsed = 0;
    forceTrip = false;
    lastGoodPayloads.clear();
  },
  forceTrip(value = true) {
    forceTrip = value;
  },
  seedLastGood(key: string, payload: unknown) {
    lastGoodPayloads.set(key, payload);
  },
  state() {
    return {
      monthKey: currentMonthKey,
      estimatedCommandsUsed,
      forceTrip,
      lastGoodCount: lastGoodPayloads.size,
    };
  },
};
