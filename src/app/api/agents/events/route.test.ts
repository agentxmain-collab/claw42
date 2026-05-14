import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const triggerSignalGenerationMock = vi.hoisted(() => vi.fn());
const getRecentSignalsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/marketSignals", () => ({
  triggerSignalGeneration: triggerSignalGenerationMock,
}));

vi.mock("@/lib/signalBuffer", () => ({
  getRecentSignals: getRecentSignalsMock,
}));

describe("/api/agents/events", () => {
  beforeEach(() => {
    triggerSignalGenerationMock.mockReset();
    getRecentSignalsMock.mockReset();
    triggerSignalGenerationMock.mockResolvedValue(null);
    getRecentSignalsMock.mockReturnValue([
      {
        id: "signal-1",
        ts: 1_715_600_000_000,
        symbol: "BTC",
        type: "breakout",
        severity: "watch",
        payload: { description: "BTC signal" },
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects legacy event feed access in production before generating signals", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(new Request("https://claw42.ai/api/agents/events?limit=10"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "debug events unavailable" });
    expect(triggerSignalGenerationMock).not.toHaveBeenCalled();
    expect(getRecentSignalsMock).not.toHaveBeenCalled();
  });

  it("requires the internal debug header outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const blocked = await GET(new Request("https://claw42.ai/api/agents/events?limit=10"));
    const allowed = await GET(
      new Request("https://claw42.ai/api/agents/events?limit=10", {
        headers: { "x-claw42-debug": "1" },
      }),
    );
    const json = await allowed.json();

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(json.signals).toHaveLength(1);
    expect(json.signals[0].id).toBe("signal-1");
    expect(json.count).toBe(1);
    expect(triggerSignalGenerationMock).toHaveBeenCalledTimes(1);
    expect(getRecentSignalsMock).toHaveBeenCalledWith(10);
  });
});
