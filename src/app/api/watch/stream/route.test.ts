import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const subscribeSharedThreadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sharedThreadStore", () => ({
  subscribeSharedThread: subscribeSharedThreadMock,
}));

describe("/api/watch/stream", () => {
  beforeEach(() => {
    subscribeSharedThreadMock.mockReset();
    subscribeSharedThreadMock.mockReturnValue(new ReadableStream<Uint8Array>());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects stream access in production before subscribing to raw threads", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(new Request("https://claw42.ai/api/watch/stream?symbol=BTC"));

    expect(response.status).toBe(403);
    if (response.status === 403) {
      await expect(response.json()).resolves.toEqual({ error: "debug stream unavailable" });
    }
    expect(subscribeSharedThreadMock).not.toHaveBeenCalled();
  });

  it("requires the internal debug header outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const blocked = await GET(new Request("https://claw42.ai/api/watch/stream?symbol=BTC"));
    const allowed = await GET(
      new Request("https://claw42.ai/api/watch/stream?symbol=BTC", {
        headers: { "x-claw42-debug": "1" },
      }),
    );

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Content-Type")).toContain("text/event-stream");
    expect(subscribeSharedThreadMock).toHaveBeenCalledTimes(1);
    expect(subscribeSharedThreadMock).toHaveBeenCalledWith("BTC");
  });
});
