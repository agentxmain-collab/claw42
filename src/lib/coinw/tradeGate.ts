import type { CoinWFuturesOrderMode } from "./oauthReadiness";
import { isDecisionFreshEnoughForTrade } from "@/lib/team/freshnessStatus";
import type { DecisionFreshnessStatus } from "@/lib/team/freshnessStatus";
import type { TradingReadinessState } from "./tradeReadinessState";

export const COINW_TRADE_GATES = ["gate1", "gate2", "gate3", "gate4"] as const;
export type CoinWTradeGate = (typeof COINW_TRADE_GATES)[number];

export interface CoinWTradeGateReadiness {
  gate: CoinWTradeGate;
  externalNavigationEnabled: boolean;
  hostedConfirmationEnabled: boolean;
  directSubmitEnabled: boolean;
  liveSubmissionBlockedBySeparateRelease: boolean;
}

export function normalizeCoinWTradeGate(value: string | undefined): CoinWTradeGate {
  return (COINW_TRADE_GATES as readonly string[]).includes(value ?? "")
    ? (value as CoinWTradeGate)
    : "gate1";
}

export function resolveCoinWTradeGate({
  env = process.env,
  orderSubmissionMode,
}: {
  env?: unknown;
  orderSubmissionMode: CoinWFuturesOrderMode;
}): CoinWTradeGateReadiness {
  const gate = normalizeCoinWTradeGate(readCoinWTradeGate(env));
  const testGateOpen = gate === "gate2" || gate === "gate3" || gate === "gate4";
  const liveRequested = orderSubmissionMode === "live";

  return {
    gate,
    externalNavigationEnabled: true,
    hostedConfirmationEnabled: orderSubmissionMode === "test" && testGateOpen,
    directSubmitEnabled: false,
    liveSubmissionBlockedBySeparateRelease: liveRequested,
  };
}

function readCoinWTradeGate(env: unknown) {
  const value = (env as { COINW_TRADE_GATE?: unknown })?.COINW_TRADE_GATE;
  return typeof value === "string" ? value : undefined;
}

export function rollbackCoinWTradeGate(gate: CoinWTradeGate): CoinWTradeGate {
  if (gate === "gate4") return "gate3";
  if (gate === "gate3") return "gate2";
  return "gate1";
}

export function hasBlockingTradeReadiness(states: readonly TradingReadinessState[] | undefined) {
  return Boolean(states?.some((state) => state.blocking));
}

export function canRenderTradeCTA({
  externalNavigationEnabled,
  executable,
  readinessStates,
  freshness,
}: {
  externalNavigationEnabled: boolean;
  executable: boolean;
  readinessStates?: readonly TradingReadinessState[];
  freshness?: DecisionFreshnessStatus | null;
}) {
  return (
    externalNavigationEnabled &&
    executable &&
    !hasBlockingTradeReadiness(readinessStates) &&
    isDecisionFreshEnoughForTrade(freshness)
  );
}
