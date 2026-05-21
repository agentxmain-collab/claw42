import { describe, expect, it } from "vitest";
import { staticCoinWFuturesInstrumentSet } from "../futuresInstruments";
import { buildCoinWFuturesOrderIntent } from "../futuresOrderIntent";
import {
  buildCoinWOrderIntentSignaturePayload,
  canonicalJson,
  nonceHash,
  signCoinWOrderIntent,
  verifySignedCoinWOrderIntent,
} from "../orderIntentSignature";

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
    instruments: staticCoinFutures(),
    now: "2026-05-20T12:00:00.000Z",
    intentId: "intent-abc123",
  },
);

function staticCoinFutures() {
  return staticCoinWFuturesInstrumentSet();
}

describe("CoinW order intent signature", () => {
  it("builds the required signed hosted-confirmation payload fields", () => {
    const signed = signCoinWOrderIntent({
      intent,
      kid: "kid-1",
      secret: "test-secret",
      now: Date.parse("2026-05-20T12:00:00.000Z"),
      nonce: "nonce-1234567890abcdef",
    });

    expect(signed).toMatchObject({
      version: 1,
      alg: "HMAC-SHA256",
      kid: "kid-1",
      nonce: "nonce-1234567890abcdef",
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      signature: expect.any(String),
      payload: {
        intentId: "intent-abc123",
        recordId: "pm:HYPE:20260520",
        coinwPair: "HYPE_USDT",
        direction: "long",
        orderType: "market",
        quantity: "50",
        leverage: 2,
        marginMode: "isolated",
        iat: 1779278400,
        exp: 1779279000,
      },
    });
    expect(nonceHash(signed.nonce)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies payload hash, signature, and expiration", () => {
    const signed = signCoinWOrderIntent({
      intent,
      kid: "kid-1",
      secret: "test-secret",
      now: Date.parse("2026-05-20T12:00:00.000Z"),
      nonce: "nonce-1234567890abcdef",
    });

    expect(
      verifySignedCoinWOrderIntent({
        signedIntent: signed,
        secret: "test-secret",
        now: Date.parse("2026-05-20T12:01:00.000Z"),
      }),
    ).toEqual({ valid: true });
    expect(
      verifySignedCoinWOrderIntent({
        signedIntent: signed,
        secret: "wrong-secret",
        now: Date.parse("2026-05-20T12:01:00.000Z"),
      }),
    ).toEqual({ valid: false, reason: "signature_mismatch" });
    expect(
      verifySignedCoinWOrderIntent({
        signedIntent: signed,
        secret: "test-secret",
        now: Date.parse("2026-05-20T12:11:00.000Z"),
      }),
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("canonicalizes JSON independent of insertion order", () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(
      buildCoinWOrderIntentSignaturePayload({
        intent,
        kid: "kid-1",
        now: Date.parse("2026-05-20T12:00:00.000Z"),
        nonce: "nonce-1234567890abcdef",
      }).nonce,
    ).toBe("nonce-1234567890abcdef");
  });
});
