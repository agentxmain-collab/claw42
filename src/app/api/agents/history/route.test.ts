import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getHistoryMessagesMock = vi.hoisted(() => vi.fn());
const getNewestGeneratedAtMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agentAnalysis", () => ({
  getHistoryMessages: getHistoryMessagesMock,
  getNewestGeneratedAt: getNewestGeneratedAtMock,
}));

describe("/api/agents/history", () => {
  beforeEach(() => {
    getHistoryMessagesMock.mockReset();
    getNewestGeneratedAtMock.mockReset();
    getHistoryMessagesMock.mockReturnValue([
      {
        id: "history-1",
        generatedAt: 1_715_600_000_000,
        agentId: "alpha",
        content: "raw legacy analysis",
        tickerSnapshot: {},
        source: "minimax",
      },
    ]);
    getNewestGeneratedAtMock.mockReturnValue(1_715_600_000_000);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects legacy history access in production before reading raw history", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(new Request("https://claw42.ai/api/agents/history?limit=10"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "debug history unavailable" });
    expect(getHistoryMessagesMock).not.toHaveBeenCalled();
    expect(getNewestGeneratedAtMock).not.toHaveBeenCalled();
  });

  it("requires the internal debug header outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const blocked = await GET(new Request("https://claw42.ai/api/agents/history?limit=10"));
    const allowed = await GET(
      new Request("https://claw42.ai/api/agents/history?limit=10", {
        headers: { "x-claw42-debug": "1" },
      }),
    );
    const json = await allowed.json();

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0].id).toBe("history-1");
    expect(json.count).toBe(1);
    expect(json.newestGeneratedAt).toBe(1_715_600_000_000);
    expect(getHistoryMessagesMock).toHaveBeenCalledTimes(1);
    expect(getHistoryMessagesMock).toHaveBeenCalledWith(10);
  });
});
