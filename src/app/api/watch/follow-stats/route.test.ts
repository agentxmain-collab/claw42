import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { __resetFollowStatsForTests } from "@/lib/watch/followStatsStore";

const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/kv-rate-limiter", () => ({
  checkRateLimit: checkRateLimitMock,
}));

describe("/api/watch/follow-stats", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    checkRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
  });

  afterEach(() => {
    __resetFollowStatsForTests();
  });

  it("closes shared public counts before follow-stat KV reads", async () => {
    const response = await GET(
      new NextRequest("https://claw42.ai/api/watch/follow-stats?recordIds=record-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: "shared_follow_stats_closed" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("records follow actions idempotently for one anon cookie", async () => {
    const first = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-stats", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" },
        body: JSON.stringify({ action: "follow", recordId: "record-1" }),
      }),
    );
    const cookie = first.headers.get("set-cookie")?.match(/claw42-anon-id=([^;]+)/)?.[1];
    expect(cookie).toBeTruthy();

    const second = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-stats", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.1",
          cookie: `claw42-anon-id=${cookie}`,
        },
        body: JSON.stringify({ action: "follow", recordId: "record-1" }),
      }),
    );
    const body = await second.json();

    expect(second.status).toBe(200);
    expect(body.stats).toEqual({ watchCount: 1, followCount: 1, userFollowed: true });
  });

  it("hashes the anonymous cookie and IP before using them in mutation rate-limit keys", async () => {
    const anonCookie = "anon-raw-cookie-id-123456";
    const rawIp = "203.0.113.3";

    const response = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-stats", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": rawIp,
          cookie: `claw42-anon-id=${anonCookie}`,
        },
        body: JSON.stringify({ action: "follow", recordId: "record-1" }),
      }),
    );

    expect(response.status).toBe(200);
    const rateLimitKeys = checkRateLimitMock.mock.calls.map((call) => call[0]);
    const anonRateLimitKey = rateLimitKeys.find((key) =>
      String(key).startsWith("watch-follow:anon:"),
    );
    const ipRateLimitKey = rateLimitKeys.find((key) => String(key).startsWith("watch-follow:ip:"));
    expect(anonRateLimitKey).toMatch(/^watch-follow:anon:[a-f0-9]{64}$/);
    expect(anonRateLimitKey).not.toContain(anonCookie);
    expect(ipRateLimitKey).toMatch(/^watch-follow:ip:[a-f0-9]{64}$/);
    expect(ipRateLimitKey).not.toContain(rawIp);
  });

  it("rate limits follow mutations before incrementing stats", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-stats", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.2" },
        body: JSON.stringify({ action: "follow", recordId: "record-1" }),
      }),
    );
    const body = await response.json();
    const cookie = response.headers.get("set-cookie")?.match(/claw42-anon-id=([^;]+)/)?.[1];
    const statsResponse = await GET(
      new NextRequest("https://claw42.ai/api/watch/follow-stats?recordIds=record-1&user=1", {
        headers: cookie ? { cookie: `claw42-anon-id=${cookie}` } : undefined,
      }),
    );
    const statsBody = await statsResponse.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("rate_limited");
    expect(statsBody.stats["record-1"]).toEqual({
      watchCount: 0,
      followCount: 0,
      userFollowed: false,
    });
    expect(statsBody.scope).toBe("user-action");
  });
});
