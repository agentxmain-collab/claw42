import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __providerTelemetryTestUtils,
  recordProviderCall,
  summarizeProviderTelemetry,
  warnIfSingleProviderConcentration,
} from "@/lib/team/providerTelemetry";

describe("provider telemetry", () => {
  beforeEach(() => {
    __providerTelemetryTestUtils.clearMemory();
    delete process.env.USE_PERSISTENT_KV;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it("records provider calls with team role metadata from task tags", async () => {
    await recordProviderCall({
      taskTag: "watch:pm-decision:onchain_analyst:zh_CN:first",
      providerChain: ["deepseek-chat", "minimax", "claude-haiku", "stub"],
      attemptedProviders: ["minimax"],
      skippedProviders: ["deepseek-chat"],
      finalProvider: "minimax",
      fallbackCount: 1,
      latencyMs: 42,
      success: true,
    });

    expect(__providerTelemetryTestUtils.memoryCalls[0]).toMatchObject({
      roleId: "onchain_analyst",
      defaultProvider: "deepseek",
      finalProvider: "minimax",
      fallbackCount: 1,
      success: true,
    });
  });

  it("summarizes fallback counts and single-provider concentration", async () => {
    await recordProviderCall({
      taskTag: "watch:pm-decision:fundamental_analyst:zh_CN:first",
      providerChain: ["deepseek-chat", "minimax"],
      attemptedProviders: ["deepseek-chat"],
      skippedProviders: [],
      finalProvider: "deepseek-chat",
      fallbackCount: 0,
      latencyMs: 10,
      success: true,
      ts: 100,
    });
    await recordProviderCall({
      taskTag: "watch:pm-decision:research_lead:zh_CN:first",
      providerChain: ["deepseek-chat", "minimax"],
      attemptedProviders: ["minimax"],
      skippedProviders: ["deepseek-chat"],
      finalProvider: "minimax",
      fallbackCount: 1,
      latencyMs: 20,
      success: true,
      ts: 101,
    });

    const summary = summarizeProviderTelemetry({ since: 100, threshold: 0.5 });

    expect(summary.providerCounts).toEqual({ "deepseek-chat": 1, minimax: 1 });
    expect(summary.fallbackCalls).toBe(1);
    expect(summary.singleProviderConcentration).toMatchObject({
      count: 1,
      ratio: 0.5,
      threshold: 0.5,
      alert: true,
    });
  });

  it("emits a non-blocking warning for concentration alerts", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await warnIfSingleProviderConcentration({
        totalCalls: 2,
        providerCounts: { "deepseek-chat": 2 },
        fallbackCalls: 0,
        failureCalls: 0,
        singleProviderConcentration: {
          provider: "deepseek-chat",
          count: 2,
          ratio: 1,
          threshold: 0.9,
          alert: true,
        },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        "[claw42] Single provider concentration",
        expect.objectContaining({ provider: "deepseek-chat", ratio: 1 }),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
