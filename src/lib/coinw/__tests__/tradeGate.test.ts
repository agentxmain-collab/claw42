import { describe, expect, it } from "vitest";
import {
  canRenderTradeCTA,
  normalizeCoinWTradeGate,
  resolveCoinWTradeGate,
  rollbackCoinWTradeGate,
} from "../tradeGate";

describe("CoinW trade gate", () => {
  it("defaults unknown values to Gate 1", () => {
    expect(normalizeCoinWTradeGate(undefined)).toBe("gate1");
    expect(normalizeCoinWTradeGate("invalid")).toBe("gate1");
  });

  it("keeps Gate 1 as navigation-only with no hosted confirmation or submit", () => {
    expect(resolveCoinWTradeGate({ orderSubmissionMode: "disabled", env: {} })).toMatchObject({
      gate: "gate1",
      externalNavigationEnabled: true,
      hostedConfirmationEnabled: false,
      directSubmitEnabled: false,
    });
  });

  it("opens hosted confirmation only in test mode and Gate 2+", () => {
    expect(
      resolveCoinWTradeGate({
        orderSubmissionMode: "test",
        env: { COINW_TRADE_GATE: "gate2" },
      }),
    ).toMatchObject({
      gate: "gate2",
      hostedConfirmationEnabled: true,
      directSubmitEnabled: false,
    });
    expect(
      resolveCoinWTradeGate({
        orderSubmissionMode: "disabled",
        env: { COINW_TRADE_GATE: "gate2" },
      }),
    ).toMatchObject({
      gate: "gate2",
      hostedConfirmationEnabled: false,
      directSubmitEnabled: false,
    });
  });

  it("does not let live mode bypass the separate release block", () => {
    expect(
      resolveCoinWTradeGate({
        orderSubmissionMode: "live",
        env: { COINW_TRADE_GATE: "gate4" },
      }),
    ).toMatchObject({
      gate: "gate4",
      hostedConfirmationEnabled: false,
      directSubmitEnabled: false,
      liveSubmissionBlockedBySeparateRelease: true,
    });
  });

  it("defines mechanical rollback targets for Gate 1 and Gate 2 drills", () => {
    expect(rollbackCoinWTradeGate("gate1")).toBe("gate1");
    expect(rollbackCoinWTradeGate("gate2")).toBe("gate1");
    expect(rollbackCoinWTradeGate("gate3")).toBe("gate2");
    expect(rollbackCoinWTradeGate("gate4")).toBe("gate3");
  });

  it("suppresses trade entry when a decision is stale even if the symbol is executable", () => {
    expect(
      canRenderTradeCTA({
        externalNavigationEnabled: true,
        executable: true,
        freshness: {
          level: "stale",
          observedAt: "2026-05-21T00:00:00.000Z",
          ageMinutes: 500,
          staleAfterMinutes: 360,
          expiredAfterMinutes: 1440,
        },
      }),
    ).toBe(false);
  });

  it("requires executable symbol, open navigation gate, and non-blocking readiness", () => {
    expect(
      canRenderTradeCTA({
        externalNavigationEnabled: true,
        executable: true,
        readinessStates: [],
        freshness: {
          level: "fresh",
          observedAt: "2026-05-22T00:00:00.000Z",
          ageMinutes: 5,
          staleAfterMinutes: 360,
          expiredAfterMinutes: 1440,
        },
      }),
    ).toBe(true);
    expect(canRenderTradeCTA({ externalNavigationEnabled: false, executable: true })).toBe(false);
    expect(canRenderTradeCTA({ externalNavigationEnabled: true, executable: false })).toBe(false);
  });
});
