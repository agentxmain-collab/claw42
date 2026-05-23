import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { staticCoinWFuturesInstrumentSet } from "@/lib/coinw/futuresInstruments";
import { buildCoinWFuturesOrderIntent } from "@/lib/coinw/futuresOrderIntent";
import {
  __coinWOrderIntentAuditStoreTestUtils,
  buildCoinWOrderIntentAuditRow,
  readCoinWOrderIntentAudit,
  writeCoinWOrderIntentAudit,
} from "@/lib/coinw/orderIntentAuditStore";
import { signCoinWOrderIntent } from "@/lib/coinw/orderIntentSignature";
import { POST } from "./route";

async function seedAuditRow(intentId = "intent-callback") {
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
      intentId,
    },
  );
  const signedIntent = signCoinWOrderIntent({
    intent,
    kid: "kid-1",
    secret: "test-secret",
    now: Date.parse("2026-05-20T12:00:00.000Z"),
    nonce: `nonce-${intentId}-abcdef`,
  });
  await writeCoinWOrderIntentAudit(
    buildCoinWOrderIntentAuditRow({
      intent,
      signedIntent,
      gate: "gate2",
      mode: "test",
    }),
  );
}

describe("POST /api/watch/follow-intents/callback", () => {
  afterEach(() => {
    __coinWOrderIntentAuditStoreTestUtils.clearMemory();
  });

  it("records a confirmed hosted confirmation callback", async () => {
    await seedAuditRow();

    const response = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-intents/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: "intent-callback",
          status: "confirmed",
          coinwOrderId: "coinw-order-1",
        }),
      }),
    );
    const payload = await response.json();
    const audit = await readCoinWOrderIntentAudit("intent-callback");

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      intentId: "intent-callback",
      status: "confirmed",
      coinwOrderId: "coinw-order-1",
    });
    expect(audit).toMatchObject({
      coinwStatus: "confirmed",
      coinwOrderId: "coinw-order-1",
    });
  });

  it("rejects malformed callbacks and unknown intent ids", async () => {
    const invalid = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-intents/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentId: "intent-callback", status: "opened" }),
      }),
    );
    const missing = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-intents/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentId: "missing", status: "confirmed" }),
      }),
    );

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
