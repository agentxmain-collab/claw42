import { describe, expect, it } from "vitest";
import {
  externalEntrySignatureMessage,
  signExternalEntryPayload,
  verifyExternalEntrySignature,
} from "../externalEntrySignature";

const payload = {
  from: "coinw_app",
  symbol: "BTC",
  pair: "BTC-USDT",
  uid: "user_hash_123456",
  ts: 1779278400,
};

describe("external entry signature", () => {
  it("signs and verifies the external entry payload", () => {
    const sig = signExternalEntryPayload({ payload, secret: "secret-1" });

    expect(externalEntrySignatureMessage(payload)).toBe(
      "coinw_app|BTC|BTC-USDT|user_hash_123456|1779278400",
    );
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(
      verifyExternalEntrySignature({
        payload: { ...payload, sig },
        secret: "secret-1",
        nowSec: 1779278410,
      }),
    ).toEqual({ valid: true });
  });

  it("rejects expired, missing, and mismatched signatures", () => {
    const sig = signExternalEntryPayload({ payload, secret: "secret-1" });

    expect(
      verifyExternalEntrySignature({
        payload: { ...payload, sig },
        secret: "secret-1",
        nowSec: 1779279001,
      }),
    ).toEqual({ valid: false, reason: "expired" });
    expect(
      verifyExternalEntrySignature({
        payload: { ...payload, sig },
        secret: undefined,
        nowSec: 1779278410,
      }),
    ).toEqual({ valid: false, reason: "missing_secret" });
    expect(
      verifyExternalEntrySignature({
        payload: { ...payload, sig },
        secret: "wrong",
        nowSec: 1779278410,
      }),
    ).toEqual({ valid: false, reason: "invalid_signature" });
  });
});
