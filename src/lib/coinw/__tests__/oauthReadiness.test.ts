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

  it("allows test submission only when OAuth and the test account are configured", () => {
    process.env.COINW_OAUTH_CLIENT_ID = "client";
    process.env.COINW_OAUTH_CLIENT_SECRET = "secret";
    process.env.COINW_OAUTH_REDIRECT_URI = "https://claw42.ai/api/coinw/oauth/callback";
    process.env.COINW_OAUTH_AUTHORIZE_URL = "https://coinw.example/oauth/authorize";
    process.env.COINW_OAUTH_TOKEN_URL = "https://coinw.example/oauth/token";
    process.env.COINW_OAUTH_SCOPES = "futures:trade";
    process.env.COINW_FUTURES_TEST_ACCOUNT_ID = "test-account";
    process.env.COINW_FUTURES_ORDER_MODE = "test";

    expect(coinWOAuthReadiness()).toMatchObject({
      oauthConfigured: true,
      testAccountConfigured: true,
      orderSubmissionMode: "test",
      realSubmissionEnabled: true,
      missingRequiredEnv: [],
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
      blockingReasons: ["live_order_submission_requires_separate_release"],
    });
  });
});
