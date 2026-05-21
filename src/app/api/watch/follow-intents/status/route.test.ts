import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { staticCoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";
import { buildCoinWFuturesOrderIntent } from "@/lib/coinw/futuresOrderIntent";
import {
  __coinWOrderIntentAuditStoreTestUtils,
  buildCoinWOrderIntentAuditRow,
  writeCoinWOrderIntentAudit,
} from "@/lib/coinw/orderIntentAuditStore";
import { signCoinWOrderIntent } from "@/lib/coinw/orderIntentSignature";

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
    __coinWOrderIntentAuditStoreTestUtils.clearMemory();
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

  it("returns hosted confirmation status when queried by intent id", async () => {
    const intent = buildCoinWFuturesOrderIntent(
      {
        recordId: "pm:HYPE:20260520",
        symbol: "HYPE",
        direction: "long",
        orderType: "market",
        quantity: "50",
        leverage: 2,
        marginMode: "isolated",
      },
      {
        instruments: staticCoinWFuturesInstrumentSet(),
        now: "2026-05-20T12:00:00.000Z",
        intentId: "intent-status",
      },
    );
    const signedIntent = signCoinWOrderIntent({
      intent,
      kid: "kid-1",
      secret: "test-secret",
      now: Date.parse("2026-05-20T12:00:00.000Z"),
      nonce: "nonce-1234567890abcdef",
    });
    await writeCoinWOrderIntentAudit(
      buildCoinWOrderIntentAuditRow({
        intent,
        signedIntent,
        gate: "gate2",
        mode: "test",
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/follow-intents/status?intentId=intent-status"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      intentId: "intent-status",
      recordId: "pm:HYPE:20260520",
      status: "created",
      coinwOrderId: null,
    });
  });
});
