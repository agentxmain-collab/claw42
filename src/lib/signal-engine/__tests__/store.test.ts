import { beforeEach, describe, expect, test } from "vitest";
import { clearSignalCache, getCachedSignals } from "@/lib/signal-engine/store";
import { evaluateSignalHealth } from "@/lib/signal-engine/health";
import { makeSignal } from "@/lib/signal-engine/__tests__/test-helpers";

describe("signal store and cooldown-style health", () => {
  beforeEach(() => {
    clearSignalCache();
  });

  test("caches builder output inside the TTL window", async () => {
    let calls = 0;
    const first = await getCachedSignals(async () => {
      calls += 1;
      return [makeSignal({ id: "cached" })];
    });
    const second = await getCachedSignals(async () => {
      calls += 1;
      return [];
    });

    expect(first).toHaveLength(1);
    expect(second[0].id).toBe("cached");
    expect(calls).toBe(1);
  });

  test("clearSignalCache forces the next builder call", async () => {
    let calls = 0;
    await getCachedSignals(async () => {
      calls += 1;
      return [makeSignal({ id: "first" })];
    });
    clearSignalCache();
    const next = await getCachedSignals(async () => {
      calls += 1;
      return [makeSignal({ id: "second" })];
    });

    expect(next[0].id).toBe("second");
    expect(calls).toBe(2);
  });

  test("health blocks distribution when cached signal set is empty", () => {
    const health = evaluateSignalHealth([], { now: new Date("2026-04-19T09:00:00.000Z") });

    expect(health.status).toBe("blocked");
    expect(health.distributionMode).toBe("hold");
    expect(health.humanInterventionRequired).toBe(true);
  });
});
