import { describe, expect, test } from "vitest";
import { ANALYTICS_EVENTS } from "../analytics";

describe("analytics event registry", () => {
  test("allows CoinW trade gate and handoff events", () => {
    expect(ANALYTICS_EVENTS).toEqual(
      expect.arrayContaining([
        "coinw_trade_cta_click",
        "coinw_intent_created",
        "coinw_handoff_opened",
        "coinw_handoff_callback_confirmed",
        "coinw_handoff_callback_rejected",
        "coinw_handoff_callback_expired",
        "coinw_handoff_callback_cancelled",
        "coinw_order_submit_error",
        "coinw_gate_rollback",
        "trade_readiness_state_rendered",
      ]),
    );
  });
});
