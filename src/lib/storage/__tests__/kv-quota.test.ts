import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kv } from "@/lib/kv-shim";
import { consumeQuota, peekQuota } from "../kv-quota";

vi.mock("@/lib/kv-shim", () => ({
  kv: {
    incrby: vi.fn(),
    decrby: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
  },
}));

const mockedKv = vi.mocked(kv);
const ORIGINAL_ENV = process.env;
const MAY_7 = Date.UTC(2026, 4, 7, 12, 0, 0);
const MAY_8 = Date.UTC(2026, 4, 8, 0, 5, 0);
const JUNE_1 = Date.UTC(2026, 5, 1, 0, 5, 0);

function configureKvEnv() {
  process.env.KV_REST_API_URL = "https://kv.example.test";
  process.env.KV_REST_API_TOKEN = "token";
}

describe("KV quota", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MAY_7);
    process.env = { ...ORIGINAL_ENV };
    configureKvEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  test("accumulates daily quota usage", async () => {
    mockedKv.incrby.mockResolvedValueOnce(2).mockResolvedValueOnce(5);

    const first = await consumeQuota("agent:dan", 2, { period: "daily", limit: 10 });
    const second = await consumeQuota("agent:dan", 3, { period: "daily", limit: 10 });

    expect(first).toMatchObject({ allowed: true, used: 2, remaining: 8 });
    expect(second).toMatchObject({ allowed: true, used: 5, remaining: 5 });
    expect(mockedKv.incrby).toHaveBeenCalledWith("quota:daily:agent:dan:2026-05-07", 2);
    expect(mockedKv.incrby).toHaveBeenCalledWith("quota:daily:agent:dan:2026-05-07", 3);
  });

  test("switches daily quota keys across UTC days", async () => {
    mockedKv.incrby.mockResolvedValueOnce(10).mockResolvedValueOnce(1);

    await consumeQuota("agent:dan", 10, { period: "daily", limit: 10 });
    vi.setSystemTime(MAY_8);
    const nextDay = await consumeQuota("agent:dan", 1, { period: "daily", limit: 10 });

    expect(nextDay.allowed).toBe(true);
    expect(mockedKv.incrby).toHaveBeenNthCalledWith(1, "quota:daily:agent:dan:2026-05-07", 10);
    expect(mockedKv.incrby).toHaveBeenNthCalledWith(2, "quota:daily:agent:dan:2026-05-08", 1);
  });

  test("accumulates monthly quota usage", async () => {
    mockedKv.incrby.mockResolvedValueOnce(4).mockResolvedValueOnce(9);

    const first = await consumeQuota("agent:dan", 4, { period: "monthly", limit: 20 });
    const second = await consumeQuota("agent:dan", 5, { period: "monthly", limit: 20 });

    expect(first).toMatchObject({ allowed: true, used: 4, remaining: 16 });
    expect(second).toMatchObject({ allowed: true, used: 9, remaining: 11 });
    expect(mockedKv.incrby).toHaveBeenCalledWith("quota:monthly:agent:dan:2026-05", 4);
    expect(mockedKv.incrby).toHaveBeenCalledWith("quota:monthly:agent:dan:2026-05", 5);
  });

  test("switches monthly quota keys across UTC months", async () => {
    mockedKv.incrby.mockResolvedValueOnce(20).mockResolvedValueOnce(2);

    await consumeQuota("agent:dan", 20, { period: "monthly", limit: 20 });
    vi.setSystemTime(JUNE_1);
    const nextMonth = await consumeQuota("agent:dan", 2, { period: "monthly", limit: 20 });

    expect(nextMonth.allowed).toBe(true);
    expect(mockedKv.incrby).toHaveBeenNthCalledWith(1, "quota:monthly:agent:dan:2026-05", 20);
    expect(mockedKv.incrby).toHaveBeenNthCalledWith(2, "quota:monthly:agent:dan:2026-06", 2);
  });

  test("rolls back the full amount when quota would exceed the limit", async () => {
    mockedKv.incrby.mockResolvedValueOnce(12);

    const result = await consumeQuota("agent:dan", 5, { period: "daily", limit: 10 });

    expect(result).toMatchObject({ allowed: false, used: 7, remaining: 0 });
    expect(mockedKv.decrby).toHaveBeenCalledWith("quota:daily:agent:dan:2026-05-07", 5);
  });

  test("peekQuota reads current usage without mutating state", async () => {
    mockedKv.get.mockResolvedValueOnce(4);

    const result = await peekQuota("agent:dan", { period: "daily", limit: 10 });

    expect(result).toMatchObject({ allowed: true, used: 4, remaining: 6 });
    expect(mockedKv.get).toHaveBeenCalledWith("quota:daily:agent:dan:2026-05-07");
    expect(mockedKv.incrby).not.toHaveBeenCalled();
    expect(mockedKv.decrby).not.toHaveBeenCalled();
    expect(mockedKv.expire).not.toHaveBeenCalled();
  });

  test("sets expiry only on the first quota write", async () => {
    mockedKv.incrby.mockResolvedValueOnce(3).mockResolvedValueOnce(5);

    await consumeQuota("agent:dan", 3, { period: "daily", limit: 10 });
    await consumeQuota("agent:dan", 2, { period: "daily", limit: 10 });

    expect(mockedKv.expire).toHaveBeenCalledTimes(1);
    expect(mockedKv.expire).toHaveBeenCalledWith("quota:daily:agent:dan:2026-05-07", 172800);
  });

  test("falls back to in-memory quota and warns once when KV is unavailable", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = await consumeQuota("local:dan", 3, { period: "daily", limit: 5 });
    const peeked = await peekQuota("local:dan", { period: "daily", limit: 5 });
    const denied = await consumeQuota("local:dan", 3, { period: "daily", limit: 5 });

    expect(first).toMatchObject({ allowed: true, used: 3, remaining: 2 });
    expect(peeked).toMatchObject({ allowed: true, used: 3, remaining: 2 });
    expect(denied).toMatchObject({ allowed: false, used: 3, remaining: 0 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(mockedKv.incrby).not.toHaveBeenCalled();
  });
});
