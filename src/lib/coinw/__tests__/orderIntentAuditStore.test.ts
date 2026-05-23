import { beforeEach, describe, expect, it } from "vitest";
import { staticCoinWFuturesInstrumentSet } from "../futuresInstruments";
import { buildCoinWFuturesOrderIntent } from "../futuresOrderIntent";
import {
  __coinWOrderIntentAuditStoreTestUtils,
  buildCoinWOrderIntentAuditRow,
  readCoinWOrderIntentAudit,
  reserveCoinWIntentNonce,
  updateCoinWOrderIntentAuditStatus,
  writeCoinWOrderIntentAudit,
} from "../orderIntentAuditStore";
import { nonceHash, signCoinWOrderIntent } from "../orderIntentSignature";

const now = Date.parse("2026-05-20T12:00:00.000Z");

function signedIntent() {
  const intent = buildCoinWFuturesOrderIntent(
    {
      recordId: "pm:HYPE:20260520",
      symbol: "HYPE",
      direction: "long",
      orderType: "market",
      quantity: "50",
      leverage: 2,
      marginMode: "isolated",
      takeProfit: "42",
      stopLoss: "35",
    },
    {
      instruments: staticCoinWFuturesInstrumentSet(),
      now: "2026-05-20T12:00:00.000Z",
      intentId: "intent-abc123",
    },
  );
  return {
    intent,
    signed: signCoinWOrderIntent({
      intent,
      kid: "kid-1",
      secret: "test-secret",
      now,
      nonce: "nonce-1234567890abcdef",
    }),
  };
}

describe("CoinW order intent audit store", () => {
  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    __coinWOrderIntentAuditStoreTestUtils.clearMemory();
  });

  it("reserves nonce hashes once until TTL expiry", async () => {
    const hash = nonceHash("nonce-1234567890abcdef");

    await expect(reserveCoinWIntentNonce(hash, { now, ttlMs: 60_000 })).resolves.toBe(true);
    await expect(reserveCoinWIntentNonce(hash, { now: now + 1_000, ttlMs: 60_000 })).resolves.toBe(
      false,
    );
    await expect(reserveCoinWIntentNonce(hash, { now: now + 61_000, ttlMs: 60_000 })).resolves.toBe(
      true,
    );
  });

  it("persists one audit row per signed intent without copying strategy text", async () => {
    const { intent, signed } = signedIntent();
    const row = buildCoinWOrderIntentAuditRow({
      intent,
      signedIntent: signed,
      gate: "gate2",
      mode: "test",
      userSessionHash: "session-hash",
      handoffUrl: "https://coinw.example/confirm?token=redacted",
    });

    await writeCoinWOrderIntentAudit(row);
    const stored = await readCoinWOrderIntentAudit("intent-abc123");

    expect(stored).toMatchObject({
      auditVersion: 1,
      intentId: "intent-abc123",
      recordId: "pm:HYPE:20260520",
      symbol: "HYPE",
      coinwPair: "HYPE_USDT",
      signatureKid: "kid-1",
      coinwStatus: "created",
      userSessionHash: "session-hash",
    });
    expect(JSON.stringify(stored)).not.toContain("take profit");
    expect(stored?.handoffUrlHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("updates status without accepting unknown intent ids", async () => {
    const { intent, signed } = signedIntent();
    await writeCoinWOrderIntentAudit(
      buildCoinWOrderIntentAuditRow({
        intent,
        signedIntent: signed,
        gate: "gate2",
        mode: "test",
      }),
    );

    await expect(
      updateCoinWOrderIntentAuditStatus("intent-abc123", {
        status: "confirmed",
        coinwOrderId: "coinw-order-1",
        callbackAt: "2026-05-20T12:05:00.000Z",
      }),
    ).resolves.toMatchObject({
      coinwStatus: "confirmed",
      coinwOrderId: "coinw-order-1",
      callbackAt: "2026-05-20T12:05:00.000Z",
    });
    await expect(
      updateCoinWOrderIntentAuditStatus("missing-intent", {
        status: "confirmed",
      }),
    ).resolves.toBeNull();
  });
});
