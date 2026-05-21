import { afterEach, describe, expect, it } from "vitest";
import { coinWOAuthReadiness } from "../oauthReadiness";

const ENV_KEYS = [
  "COINW_OAUTH_CLIENT_ID",
  "COINW_OAUTH_CLIENT_SECRET",
  "COINW_OAUTH_REDIRECT_URI",
  "COINW_OAUTH_AUTHORIZE_URL",
  "COINW_OAUTH_TOKEN_URL",
  "COINW_OAUTH_SCOPES",
  "COINW_FUTURES_TEST_ACCOUNT_ID",
  "COINW_FUTURES_ORDER_MODE",
  "COINW_TRADE_GATE",
] as const;

describe("coinWOAuthReadiness", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("reports missing external CoinW OAuth inputs without exposing secret values", () => {
    const readiness = coinWOAuthReadiness();

    expect(readiness.oauthConfigured).toBe(false);
    expect(readiness.orderSubmissionMode).toBe("disabled");
    expect(readiness.realSubmissionEnabled).toBe(false);
    expect(readiness.missingRequiredEnv).toEqual(
      expect.arrayContaining([
        "COINW_OAUTH_CLIENT_ID",
        "COINW_OAUTH_CLIENT_SECRET",
        "COINW_OAUTH_REDIRECT_URI",
        "COINW_OAUTH_AUTHORIZE_URL",
        "COINW_OAUTH_TOKEN_URL",
        "COINW_OAUTH_SCOPES",
        "COINW_FUTURES_TEST_ACCOUNT_ID",
      ]),
    );
  });

  it("allows hosted confirmation only when OAuth, test account, mode, and gate are configured", () => {
    process.env.COINW_OAUTH_CLIENT_ID = "client";
    process.env.COINW_OAUTH_CLIENT_SECRET = "secret";
    process.env.COINW_OAUTH_REDIRECT_URI = "https://claw42.ai/api/coinw/oauth/callback";
    process.env.COINW_OAUTH_AUTHORIZE_URL = "https://coinw.example/oauth/authorize";
    process.env.COINW_OAUTH_TOKEN_URL = "https://coinw.example/oauth/token";
    process.env.COINW_OAUTH_SCOPES = "futures:trade";
    process.env.COINW_FUTURES_TEST_ACCOUNT_ID = "test-account";
    process.env.COINW_FUTURES_ORDER_MODE = "test";
    process.env.COINW_TRADE_GATE = "gate2";

    expect(coinWOAuthReadiness()).toMatchObject({
      oauthConfigured: true,
      testAccountConfigured: true,
      orderSubmissionMode: "test",
      realSubmissionEnabled: true,
      tradeGate: {
        gate: "gate2",
        hostedConfirmationEnabled: true,
        directSubmitEnabled: false,
      },
      missingRequiredEnv: [],
    });
  });

  it("keeps test mode blocked at Gate 1 even when OAuth is configured", () => {
    process.env.COINW_OAUTH_CLIENT_ID = "client";
    process.env.COINW_OAUTH_CLIENT_SECRET = "secret";
    process.env.COINW_OAUTH_REDIRECT_URI = "https://claw42.ai/api/coinw/oauth/callback";
    process.env.COINW_OAUTH_AUTHORIZE_URL = "https://coinw.example/oauth/authorize";
    process.env.COINW_OAUTH_TOKEN_URL = "https://coinw.example/oauth/token";
    process.env.COINW_OAUTH_SCOPES = "futures:trade";
    process.env.COINW_FUTURES_TEST_ACCOUNT_ID = "test-account";
    process.env.COINW_FUTURES_ORDER_MODE = "test";

    expect(coinWOAuthReadiness()).toMatchObject({
      orderSubmissionMode: "test",
      realSubmissionEnabled: false,
      tradeGate: {
        gate: "gate1",
        hostedConfirmationEnabled: false,
        directSubmitEnabled: false,
      },
    });
  });

  it("keeps live order submission disabled until explicitly requested later", () => {
    process.env.COINW_OAUTH_CLIENT_ID = "client";
    process.env.COINW_OAUTH_CLIENT_SECRET = "secret";
    process.env.COINW_OAUTH_REDIRECT_URI = "https://claw42.ai/api/coinw/oauth/callback";
    process.env.COINW_OAUTH_AUTHORIZE_URL = "https://coinw.example/oauth/authorize";
    process.env.COINW_OAUTH_TOKEN_URL = "https://coinw.example/oauth/token";
    process.env.COINW_OAUTH_SCOPES = "futures:trade";
    process.env.COINW_FUTURES_TEST_ACCOUNT_ID = "test-account";
    process.env.COINW_FUTURES_ORDER_MODE = "live";

    expect(coinWOAuthReadiness()).toMatchObject({
      orderSubmissionMode: "live",
      realSubmissionEnabled: false,
      tradeGate: {
        gate: "gate1",
        directSubmitEnabled: false,
        liveSubmissionBlockedBySeparateRelease: true,
      },
      blockingReasons: ["live_order_submission_requires_separate_release"],
    });
  });
});
