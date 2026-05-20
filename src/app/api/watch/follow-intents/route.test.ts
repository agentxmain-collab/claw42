import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/kv-rate-limiter", () => ({
  checkRateLimit: checkRateLimitMock,
}));

describe("/api/watch/follow-intents", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    checkRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
  });

  it("creates a disabled CoinW futures intent draft for a supported symbol", async () => {
    const response = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-intents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
        body: JSON.stringify({
          recordId: "pm:HYPE:20260520",
          symbol: "HYPE",
          direction: "long",
          orderType: "market",
          quantity: "50",
          leverage: 2,
          marginMode: "isolated",
          takeProfit: "42",
          stopLoss: "35",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe("disabled");
    expect(body.reason).toBe("coinw_real_submission_not_enabled");
    expect(body.intent.source.source).toBe("claw42");
    expect(body.intent.coinwRequest.endpoint).toBe("/v1/perpum/order");
    expect(body.intent.coinwRequest.body).toMatchObject({
      instrument: "HYPE",
      direction: "long",
      thirdOrderId: expect.stringMatching(/^claw42_[A-Za-z0-9_-]+_1$/),
    });
    expect(body.intent.coinwRequest.body.thirdOrderId.length).toBeLessThanOrEqual(50);
  });

  it("rejects unsupported symbols before creating an intent", async () => {
    const response = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-intents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
        body: JSON.stringify({
          recordId: "pm:VVV:20260520",
          symbol: "VVV",
          direction: "long",
          orderType: "market",
          quantity: "50",
          leverage: 2,
          marginMode: "isolated",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("coinw_futures_symbol_not_supported");
  });

  it("rate limits intent creation by hashed IP bucket", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(
      new NextRequest("https://claw42.ai/api/watch/follow-intents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
        body: JSON.stringify({
          recordId: "pm:HYPE:20260520",
          symbol: "HYPE",
          direction: "long",
          orderType: "market",
          quantity: "50",
          leverage: 2,
          marginMode: "isolated",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("rate_limited");
    expect(String(checkRateLimitMock.mock.calls[0]?.[0])).toMatch(
      /^watch-follow-intent:ip:[a-f0-9]{64}$/,
    );
  });
});
