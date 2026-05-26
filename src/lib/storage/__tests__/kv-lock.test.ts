import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  LockBusyError,
  __kvLockTestUtils,
  checkLock,
  releaseLock,
  tryAcquireLock,
  withLock,
} from "@/lib/storage/kv-lock";

type SetOptions = { nx?: boolean; px?: number };
type Entry = { value: string | number; expiresAt: number };

const store = new Map<string, Entry>();
const mocks = vi.hoisted(() => ({
  eval: vi.fn(async (script: string, keys: string[], args: string[]) => {
    void script;
    const existing = getValue(keys[0]);
    if (existing === args[0]) {
      store.delete(keys[0]);
      if (keys[1]) store.delete(keys[1]);
      return 1;
    }
    return 0;
  }),
}));

vi.mock("@/lib/kv-shim", () => ({
  kv: {
    set: vi.fn(async (key: string, value: string | number, options: SetOptions = {}) => {
      cleanup(key);
      if (options.nx && store.has(key)) return null;
      store.set(key, { value, expiresAt: Date.now() + (options.px ?? 30_000) });
      return "OK";
    }),
    get: vi.fn(async (key: string) => getValue(key)),
    del: vi.fn(async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
    eval: mocks.eval,
  },
}));

describe("kv-lock", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    store.clear();
    __kvLockTestUtils.clearMemoryLocks();
    mocks.eval.mockClear();
    process.env.KV_REST_API_URL = "https://kv.example.test";
    process.env.KV_REST_API_TOKEN = "test-token";
  });

  test("tryAcquireLock succeeds first and returns a handle", async () => {
    const handle = await tryAcquireLock("daily-brief");

    expect(handle?.key).toBe("daily-brief");
    expect(handle?.token).toEqual(expect.any(String));
    expect(store.get("lock:daily-brief")?.value).toBe(handle?.token);
  });

  test("same key cannot be acquired twice before release", async () => {
    const first = await tryAcquireLock("same-key");
    const second = await tryAcquireLock("same-key");

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  test("checkLock reports KV-backed lock presence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 4, 18, 12, 0, 0));
    await tryAcquireLock("status-key");

    await expect(checkLock("status-key")).resolves.toMatchObject({
      key: "status-key",
      locked: true,
      expiresAt: Date.UTC(2026, 4, 18, 12, 0, 30),
    });
    await expect(checkLock("missing-key")).resolves.toMatchObject({
      key: "missing-key",
      locked: false,
      expiresAt: null,
    });
  });

  test("TTL expiration lets a later caller acquire the same key", async () => {
    vi.useFakeTimers();
    const first = await tryAcquireLock("ttl-key", { ttlMs: 100 });

    await vi.advanceTimersByTimeAsync(101);
    const second = await tryAcquireLock("ttl-key", { ttlMs: 100 });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.token).not.toBe(first?.token);
  });

  test("releaseLock deletes only when token matches", async () => {
    const handle = await tryAcquireLock("release-key");

    expect(handle).not.toBeNull();
    await expect(releaseLock(handle!)).resolves.toBe(true);
    expect(store.has("lock:release-key")).toBe(false);
    expect(store.has("lock-meta:release-key")).toBe(false);
  });

  test("releaseLock refuses a mismatched token", async () => {
    const handle = await tryAcquireLock("token-key");

    await expect(releaseLock({ ...handle!, token: "wrong-token" })).resolves.toBe(false);
    expect(store.has("lock:token-key")).toBe(true);
    expect(store.has("lock-meta:token-key")).toBe(true);
  });

  test("releaseLock falls back to token-checked get plus del when eval is unavailable", async () => {
    mocks.eval.mockRejectedValueOnce(new Error("eval unsupported"));
    const handle = await tryAcquireLock("fallback-release");

    await expect(releaseLock(handle!)).resolves.toBe(true);
    expect(store.has("lock:fallback-release")).toBe(false);
    expect(store.has("lock-meta:fallback-release")).toBe(false);
  });

  test("withLock returns the wrapped function value and releases", async () => {
    const value = await withLock("wrapped", async () => "done");
    const reacquired = await tryAcquireLock("wrapped");

    expect(value).toBe("done");
    expect(reacquired).not.toBeNull();
  });

  test("withLock releases when the wrapped function throws", async () => {
    await expect(
      withLock("throwing", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(tryAcquireLock("throwing")).resolves.not.toBeNull();
  });

  test("withLock throws LockBusyError when wait window expires", async () => {
    await tryAcquireLock("busy");

    await expect(withLock("busy", async () => "never", { waitMs: 10 })).rejects.toBeInstanceOf(
      LockBusyError,
    );
  });

  test("in-memory fallback works when KV env is missing", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const first = await tryAcquireLock("memory", { ttlMs: 100 });
    const second = await tryAcquireLock("memory", { ttlMs: 100 });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    await expect(releaseLock(first!)).resolves.toBe(true);
    warn.mockRestore();
  });

  test("in-memory fallback expires locks after TTL", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers();

    const first = await tryAcquireLock("memory-ttl", { ttlMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    const second = await tryAcquireLock("memory-ttl", { ttlMs: 100 });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  test("checkLock reports in-memory lock expiry", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers();

    await tryAcquireLock("memory-status", { ttlMs: 100 });
    await expect(checkLock("memory-status")).resolves.toMatchObject({
      key: "memory-status",
      locked: true,
      expiresAt: expect.any(Number),
    });
    await vi.advanceTimersByTimeAsync(101);
    await expect(checkLock("memory-status")).resolves.toMatchObject({
      key: "memory-status",
      locked: false,
      expiresAt: null,
    });
  });
});

function getValue(key: string) {
  cleanup(key);
  return store.get(key)?.value ?? null;
}

function cleanup(key: string) {
  const entry = store.get(key);
  if (entry && entry.expiresAt <= Date.now()) store.delete(key);
}
