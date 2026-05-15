import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const subscribeSharedThreadMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const createWatchTimelineSseStreamMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sharedThreadStore", () => ({
  subscribeSharedThread: subscribeSharedThreadMock,
}));

vi.mock("@/lib/storage/kv-rate-limiter", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/watch/sseBroker", () => ({
  createWatchTimelineSseStream: createWatchTimelineSseStreamMock,
  WATCH_TIMELINE_SSE_HEADERS: {
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  },
}));

describe("/api/watch/stream", () => {
  beforeEach(() => {
    subscribeSharedThreadMock.mockReset();
    subscribeSharedThreadMock.mockReturnValue(new ReadableStream<Uint8Array>());
    checkRateLimitMock.mockReset();
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 19, resetAt: Date.now() });
    createWatchTimelineSseStreamMock.mockReset();
    createWatchTimelineSseStreamMock.mockReturnValue(new ReadableStream<Uint8Array>());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves the public watch timeline stream in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(
      new Request("https://claw42.ai/api/watch/stream?locale=zh_CN&windowMinutes=60", {
        headers: { "x-forwarded-for": "203.0.113.8" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.stringMatching(/^watch-stream:ip:/), {
      max: 20,
      windowMs: 60_000,
    });
    expect(createWatchTimelineSseStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh_CN", windowMinutes: 60 }),
    );
    expect(subscribeSharedThreadMock).not.toHaveBeenCalled();
  });

  it("keeps the raw shared-thread stream behind the internal debug header", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const blocked = await GET(
      new Request("https://claw42.ai/api/watch/stream?mode=thread&symbol=BTC"),
    );
    const allowed = await GET(
      new Request("https://claw42.ai/api/watch/stream?mode=thread&symbol=BTC", {
        headers: { "x-claw42-debug": "1" },
      }),
    );

    expect(blocked.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Content-Type")).toContain("text/event-stream");
    expect(subscribeSharedThreadMock).toHaveBeenCalledTimes(1);
    expect(subscribeSharedThreadMock).toHaveBeenCalledWith("BTC");
  });

  it("rate limits public watch timeline streams before opening the SSE broker", async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: 1234 });

    const response = await GET(new Request("https://claw42.ai/api/watch/stream?locale=zh_CN"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
    expect(createWatchTimelineSseStreamMock).not.toHaveBeenCalled();
  });
});
