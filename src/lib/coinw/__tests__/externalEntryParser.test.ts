import { describe, expect, it } from "vitest";
import { parseExternalEntry } from "../externalEntryParser";
import { signExternalEntryPayload } from "../externalEntrySignature";
import { serializedSearchParamsToURLSearchParams } from "../landingContext";

function signedParams(overrides: Record<string, string> = {}) {
  const base = {
    from: "futures_fab",
    symbol: "BTC",
    pair: "BTC-USDT",
    uid_hash: "user_hash_123456",
    ts: "1779278400",
    ...overrides,
  };
  const sig = signExternalEntryPayload({
    payload: {
      from: base.from,
      symbol: base.symbol,
      pair: base.pair,
      uid: base.uid_hash,
      ts: Number(base.ts),
    },
    secret: "secret-1",
  });

  return new URLSearchParams({ ...base, sig });
}

describe("external entry parser", () => {
  it("returns an empty context when no external query is present", () => {
    expect(
      parseExternalEntry({
        searchParams: new URLSearchParams("utm_source=organic"),
        secret: "secret-1",
        nowSec: 1779278400,
      }),
    ).toMatchObject({
      isExternalEntry: false,
      landing_id: null,
      from: "unknown",
    });
  });

  it("normalizes a signed CoinW entry into a safe landing context", () => {
    const context = parseExternalEntry({
      searchParams: signedParams({ deep_link: "stage_card", utm_source: "coinw" }),
      secret: "secret-1",
      nowSec: 1779278410,
    });

    expect(context).toMatchObject({
      isExternalEntry: true,
      from: "futures_fab",
      symbol: "BTC",
      pair: "BTC_USDT",
      uid_hash: "user_hash_123456",
      sig_valid: true,
      deep_link: "stage_card",
      utm: { utm_source: "coinw" },
    });
    expect(context.landing_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("keeps analytics attribution while dropping uid_hash when signature is invalid", () => {
    const params = signedParams();
    params.set("sig", "0".repeat(64));

    const context = parseExternalEntry({
      searchParams: params,
      secret: "secret-1",
      nowSec: 1779278410,
    });

    expect(context).toMatchObject({
      isExternalEntry: true,
      from: "futures_fab",
      uid_hash: null,
      sig_valid: false,
      sig_reason: "invalid_signature",
    });
  });

  it("serializes Next searchParams shape without dropping repeated values", () => {
    const params = serializedSearchParamsToURLSearchParams({
      from: "futures_fab",
      tag: ["a", "b"],
      empty: undefined,
    });

    expect(params.get("from")).toBe("futures_fab");
    expect(params.getAll("tag")).toEqual(["a", "b"]);
    expect(params.has("empty")).toBe(false);
  });
});
