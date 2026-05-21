export type TradingReadinessFailureKind =
  | "analysis_data_degraded"
  | "instrument_unavailable"
  | "auth_account_not_ready"
  | "user_risk_confirmation_required"
  | "submission_mode_blocked"
  | "exchange_network_or_result_failed";

export type TradingReadinessSeverity = "info" | "degraded" | "blocked" | "error";

export type TradingReadinessSource =
  | "analysis_pipeline"
  | "coinw_instrument"
  | "oauth_readiness"
  | "user_confirmation"
  | "order_submission"
  | "exchange_result";

export interface TradingReadinessState {
  kind: TradingReadinessFailureKind;
  severity: TradingReadinessSeverity;
  blocking: boolean;
  retryable: boolean;
  source: TradingReadinessSource;
  code: string;
  i18nKey: string;
  observedAt: string;
  technicalDetails?: Record<string, string | number | boolean | null>;
}

export interface TradingReadinessOAuthInput {
  oauthConfigured: boolean;
  testAccountConfigured: boolean;
  orderSubmissionMode: "disabled" | "test" | "live";
  missingRequiredEnv: string[];
  blockingReasons: string[];
}

export const TRADING_READINESS_STATE_VERSION = 1;

export const TRADING_READINESS_FAILURE_KINDS: TradingReadinessFailureKind[] = [
  "analysis_data_degraded",
  "instrument_unavailable",
  "auth_account_not_ready",
  "user_risk_confirmation_required",
  "submission_mode_blocked",
  "exchange_network_or_result_failed",
];

export const TRADING_READINESS_SEVERITIES: TradingReadinessSeverity[] = [
  "info",
  "degraded",
  "blocked",
  "error",
];

function observedAt(now = Date.now()) {
  return new Date(now).toISOString();
}

function state({
  kind,
  severity,
  blocking,
  retryable,
  source,
  code,
  now,
  technicalDetails,
}: Omit<TradingReadinessState, "i18nKey" | "observedAt"> & {
  now?: number;
}): TradingReadinessState {
  return {
    kind,
    severity,
    blocking,
    retryable,
    source,
    code,
    i18nKey: `agentWatch.tradeReadiness.states.${kind}`,
    observedAt: observedAt(now),
    technicalDetails,
  };
}

export function tradingReadinessStatesFromOAuth(
  readiness: TradingReadinessOAuthInput,
  now = Date.now(),
): TradingReadinessState[] {
  const states: TradingReadinessState[] = [];

  if (!readiness.oauthConfigured || !readiness.testAccountConfigured) {
    states.push(
      state({
        kind: "auth_account_not_ready",
        severity: "blocked",
        blocking: true,
        retryable: true,
        source: "oauth_readiness",
        code: readiness.oauthConfigured
          ? "coinw_test_account_not_configured"
          : "coinw_oauth_not_configured",
        now,
        technicalDetails: {
          missingRequiredEnvCount: readiness.missingRequiredEnv.length,
          oauthConfigured: readiness.oauthConfigured,
          testAccountConfigured: readiness.testAccountConfigured,
        },
      }),
    );
  }

  if (readiness.orderSubmissionMode === "disabled") {
    states.push(
      state({
        kind: "submission_mode_blocked",
        severity: "blocked",
        blocking: true,
        retryable: false,
        source: "order_submission",
        code: "coinw_order_submission_disabled",
        now,
      }),
    );
  }

  if (readiness.orderSubmissionMode === "live") {
    states.push(
      state({
        kind: "submission_mode_blocked",
        severity: "blocked",
        blocking: true,
        retryable: false,
        source: "order_submission",
        code: "live_order_submission_requires_separate_release",
        now,
      }),
    );
  }

  return states;
}

export function tradingReadinessStateFromIntentError(
  code: string,
  now = Date.now(),
): TradingReadinessState {
  if (code === "coinw_futures_symbol_not_supported") {
    return state({
      kind: "instrument_unavailable",
      severity: "blocked",
      blocking: true,
      retryable: false,
      source: "coinw_instrument",
      code,
      now,
    });
  }

  if (code === "rate_limited") {
    return state({
      kind: "exchange_network_or_result_failed",
      severity: "error",
      blocking: true,
      retryable: true,
      source: "order_submission",
      code,
      now,
    });
  }

  if (
    code.startsWith("invalid_") ||
    code.includes("_quantity_") ||
    code.includes("_price_") ||
    code.includes("_leverage_") ||
    code.includes("_margin_")
  ) {
    return state({
      kind: "user_risk_confirmation_required",
      severity: "blocked",
      blocking: true,
      retryable: true,
      source: "user_confirmation",
      code,
      now,
    });
  }

  return state({
    kind: "exchange_network_or_result_failed",
    severity: "error",
    blocking: true,
    retryable: true,
    source: "exchange_result",
    code,
    now,
  });
}

export function tradingReadinessPayload(states: TradingReadinessState[]) {
  return {
    stateVersion: TRADING_READINESS_STATE_VERSION,
    states,
    blocking: states.some((item) => item.blocking),
  };
}
