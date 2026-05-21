import { describe, expect, it } from "vitest";
import {
  tradingReadinessPayload,
  tradingReadinessStateFromIntentError,
  tradingReadinessStatesFromOAuth,
} from "@/lib/coinw/tradeReadinessState";

const now = Date.UTC(2026, 4, 21, 10, 0, 0);

describe("tradeReadinessState", () => {
  it("maps missing OAuth and disabled submission to blocking states without secret values", () => {
    const states = tradingReadinessStatesFromOAuth(
      {
        oauthConfigured: false,
        testAccountConfigured: false,
        orderSubmissionMode: "disabled",
        missingRequiredEnv: ["COINW_OAUTH_CLIENT_SECRET", "COINW_FUTURES_TEST_ACCOUNT_ID"],
        blockingReasons: ["coinw_oauth_not_configured", "coinw_order_submission_disabled"],
      },
      now,
    );

    expect(states.map((state) => state.kind)).toEqual([
      "auth_account_not_ready",
      "submission_mode_blocked",
    ]);
    expect(JSON.stringify(states)).not.toContain("COINW_OAUTH_CLIENT_SECRET");
    expect(states[0].technicalDetails).toMatchObject({ missingRequiredEnvCount: 2 });
  });

  it("keeps live mode blocked for a separate release", () => {
    const states = tradingReadinessStatesFromOAuth(
      {
        oauthConfigured: true,
        testAccountConfigured: true,
        orderSubmissionMode: "live",
        missingRequiredEnv: [],
        blockingReasons: ["live_order_submission_requires_separate_release"],
      },
      now,
    );

    expect(states).toEqual([
      expect.objectContaining({
        kind: "submission_mode_blocked",
        code: "live_order_submission_requires_separate_release",
        blocking: true,
      }),
    ]);
  });

  it("maps intent errors into the six source-layer failure taxonomy", () => {
    expect(tradingReadinessStateFromIntentError("coinw_futures_symbol_not_supported", now)).toEqual(
      expect.objectContaining({
        kind: "instrument_unavailable",
        source: "coinw_instrument",
        retryable: false,
      }),
    );
    expect(tradingReadinessStateFromIntentError("rate_limited", now)).toEqual(
      expect.objectContaining({
        kind: "exchange_network_or_result_failed",
        source: "order_submission",
        retryable: true,
      }),
    );
    expect(tradingReadinessStateFromIntentError("coinw_futures_quantity_required", now)).toEqual(
      expect.objectContaining({
        kind: "user_risk_confirmation_required",
        source: "user_confirmation",
      }),
    );
  });

  it("summarizes readiness states into a stable payload", () => {
    const payload = tradingReadinessPayload([
      tradingReadinessStateFromIntentError("coinw_futures_symbol_not_supported", now),
    ]);

    expect(payload).toMatchObject({
      stateVersion: 1,
      blocking: true,
      states: [expect.objectContaining({ kind: "instrument_unavailable" })],
    });
  });
});
