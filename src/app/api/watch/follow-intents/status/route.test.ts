import { afterEach, describe, expect, it } from "vitest";

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

describe("GET /api/watch/follow-intents/status", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("returns a safe disabled readiness payload before external CoinW setup is complete", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      realSubmissionEnabled: false,
      orderSubmissionMode: "disabled",
      oauthConfigured: false,
      tradeReadiness: {
        blocking: true,
        states: expect.arrayContaining([
          expect.objectContaining({ kind: "auth_account_not_ready" }),
          expect.objectContaining({ kind: "submission_mode_blocked" }),
        ]),
      },
    });
    expect(JSON.stringify(payload)).not.toContain("super-secret-value");
  });
});
