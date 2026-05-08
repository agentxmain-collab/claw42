import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kv } from "@vercel/kv";
import { checkRateLimit } from "../kv-rate-limiter";

vi.mock("@vercel/kv", () => ({
  kv: {
    incr: vi.fn(),
    expire: vi.fn(),
  },
}));

const mockedKv = vi.mocked(kv);
const ORIGINAL_ENV = process.env;
const BASE_TIME = Date.UTC(2026, 4, 7, 12, 0, 0);

function configureKvEnv() {
  process.env.KV_REST_API_URL = "https://kv.example.test";
  process.env.KV_REST_API_TOKEN = "token";
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env = { ...ORIGINAL_ENV };
    configureKvEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  test("allows requests through the configured max within one window", async () => {
    mockedKv.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    await expect(checkRateLimit("agent:dan", { max: 3, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 2,
    });
    await expect(checkRateLimit("agent:dan", { max: 3, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(checkRateLimit("agent:dan", { max: 3, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  test("denies the max plus one request in the same window", async () => {
    mockedKv.incr.mockResolvedValueOnce(4);

    const result = await checkRateLimit("agent:dan", { max: 3, windowMs: 60_000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("sets expiry only on the first increment of a fixed window", async () => {
    mockedKv.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    await checkRateLimit("agent:dan", { max: 3, windowMs: 90_000 });
    await checkRateLimit("agent:dan", { max: 3, windowMs: 90_000 });

    expect(mockedKv.expire).toHaveBeenCalledTimes(1);
    expect(mockedKv.expire).toHaveBeenCalledWith(`rate:agent:dan:${BASE_TIME}`, 90);
  });

  test("uses a new counter after the fixed window resets", async () => {
    mockedKv.incr.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

    const denied = await checkRateLimit("agent:dan", { max: 3, windowMs: 60_000 });
    vi.setSystemTime(BASE_TIME + 60_000);
    const allowed = await checkRateLimit("agent:dan", { max: 3, windowMs: 60_000 });

    expect(denied.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
    expect(mockedKv.incr).toHaveBeenNthCalledWith(1, `rate:agent:dan:${BASE_TIME}`);
    expect(mockedKv.incr).toHaveBeenNthCalledWith(2, `rate:agent:dan:${BASE_TIME + 60_000}`);
  });

  test("keeps different keys independent", async () => {
    mockedKv.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const first = await checkRateLimit("agent:dan", { max: 1, windowMs: 60_000 });
    const second = await checkRateLimit("agent:airy", { max: 1, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(mockedKv.incr).toHaveBeenNthCalledWith(1, `rate:agent:dan:${BASE_TIME}`);
    expect(mockedKv.incr).toHaveBeenNthCalledWith(2, `rate:agent:airy:${BASE_TIME}`);
  });

  test("calculates remaining and resetAt from the current fixed window", async () => {
    mockedKv.incr.mockResolvedValueOnce(2);

    const result = await checkRateLimit("agent:dan", { max: 5, windowMs: 60_000 });

    expect(result).toEqual({
      allowed: true,
      remaining: 3,
      resetAt: BASE_TIME + 60_000,
    });
  });

  test("falls back to in-memory counters and warns once when KV is unavailable", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = await checkRateLimit("local:dan", { max: 2, windowMs: 60_000 });
    const second = await checkRateLimit("local:dan", { max: 2, windowMs: 60_000 });
    const third = await checkRateLimit("local:dan", { max: 2, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(mockedKv.incr).not.toHaveBeenCalled();
  });
});
