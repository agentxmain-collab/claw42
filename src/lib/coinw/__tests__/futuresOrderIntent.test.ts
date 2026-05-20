import { describe, expect, it } from "vitest";
import { staticCoinWFuturesInstrumentSet } from "../futuresInstruments";
import { buildCoinWFuturesOrderIntent, buildCoinWFuturesThirdOrderId } from "../futuresOrderIntent";

const instruments = staticCoinWFuturesInstrumentSet();

describe("CoinW futures order intent", () => {
  it("builds a CoinW futures market intent with a Claw42 source marker", () => {
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
      { instruments, now: "2026-05-20T12:00:00.000Z", intentId: "intent-abc123" },
    );

    expect(intent.status).toBe("pending_confirmation");
    expect(intent.source).toEqual({
      source: "claw42",
      intentId: "intent-abc123",
      recordId: "pm:HYPE:20260520",
    });
    expect(intent.coinwRequest).toEqual({
      method: "POST",
      endpoint: "/v1/perpum/order",
      body: {
        instrument: "HYPE",
        direction: "long",
        leverage: 2,
        quantityUnit: 0,
        quantity: "50",
        positionModel: 0,
        positionType: "execute",
        stopProfitPrice: "42",
        stopLossPrice: "35",
        thirdOrderId: "claw42_intent-abc123_1",
      },
    });
  });

  it("builds a limit short intent with open price and cross margin", () => {
    const intent = buildCoinWFuturesOrderIntent(
      {
        recordId: "pm:BILL:20260520",
        symbol: "BILL",
        direction: "short",
        orderType: "limit",
        quantity: 20,
        price: 0.12,
        leverage: 1,
        marginMode: "cross",
      },
      { instruments, now: "2026-05-20T12:00:00.000Z", intentId: "intent-limit" },
    );

    expect(intent.coinwRequest.body).toMatchObject({
      instrument: "BILL",
      direction: "short",
      positionModel: 1,
      positionType: "plan",
      openPrice: "0.12",
      thirdOrderId: "claw42_intent-limit_1",
    });
  });

  it("rejects symbols that are not confirmed CoinW futures instruments", () => {
    expect(() =>
      buildCoinWFuturesOrderIntent(
        {
          recordId: "pm:VVV:20260520",
          symbol: "VVV",
          direction: "long",
          orderType: "market",
          quantity: "50",
          leverage: 2,
          marginMode: "isolated",
        },
        { instruments, now: "2026-05-20T12:00:00.000Z", intentId: "intent-vvv" },
      ),
    ).toThrow("coinw_futures_symbol_not_supported");
  });

  it("keeps thirdOrderId within CoinW documented character and length rules", () => {
    const thirdOrderId = buildCoinWFuturesThirdOrderId(
      "record:with/slashes and unicode 測試 and a very long suffix that should shrink",
      12,
    );

    expect(thirdOrderId).toMatch(/^claw42_[A-Za-z0-9_-]+_12$/);
    expect(thirdOrderId.length).toBeLessThanOrEqual(50);
  });

  it("requires quantity and open price before an intent can be confirmed", () => {
    expect(() =>
      buildCoinWFuturesOrderIntent(
        {
          recordId: "pm:BTC:20260520",
          symbol: "BTC",
          direction: "long",
          orderType: "market",
          quantity: "0",
          leverage: 2,
          marginMode: "isolated",
        },
        { instruments, now: "2026-05-20T12:00:00.000Z", intentId: "intent-zero" },
      ),
    ).toThrow("coinw_futures_quantity_required");

    expect(() =>
      buildCoinWFuturesOrderIntent(
        {
          recordId: "pm:BTC:20260520",
          symbol: "BTC",
          direction: "long",
          orderType: "limit",
          quantity: "20",
          leverage: 2,
          marginMode: "isolated",
        },
        { instruments, now: "2026-05-20T12:00:00.000Z", intentId: "intent-no-price" },
      ),
    ).toThrow("coinw_futures_limit_price_required");
  });

  it("applies the beta leverage cap before real order submission is enabled", () => {
    expect(() =>
      buildCoinWFuturesOrderIntent(
        {
          recordId: "pm:BTC:20260520",
          symbol: "BTC",
          direction: "long",
          orderType: "market",
          quantity: "20",
          leverage: 10,
          marginMode: "isolated",
        },
        {
          instruments,
          now: "2026-05-20T12:00:00.000Z",
          intentId: "intent-high-leverage",
          betaMaxLeverage: 3,
        },
      ),
    ).toThrow("coinw_futures_leverage_exceeds_beta_limit");
  });
});
