import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createMetricsEmitter } from "../metrics";
import type { KvClient } from "../kv-metrics";

describe("metrics.emit", () => {
  it("writes JSONL in development", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "claw42-metrics-"));
    try {
      const emitter = createMetricsEmitter({
        env: { NODE_ENV: "development" } as NodeJS.ProcessEnv,
        now: () => new Date("2026-05-07T10:00:00.000Z"),
        rootDir,
      });

      await emitter.emit("Test Metric", { a: 1 }, 42);

      const output = await readFile(
        join(rootDir, "reports", "metrics", "2026-05-07.jsonl"),
        "utf8",
      );
      expect(JSON.parse(output.trim())).toMatchObject({
        name: "test_metric",
        properties: { a: 1 },
        value: 42,
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("writes KV in production when KV config is present", async () => {
    const client: KvClient = {
      lpush: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };
    const emitter = createMetricsEmitter({
      env: {
        NODE_ENV: "production",
        KV_REST_API_URL: "https://kv.example",
        KV_REST_API_TOKEN: "token",
      } as NodeJS.ProcessEnv,
      kvClient: client,
      now: () => new Date("2026-05-07T10:00:00.000Z"),
    });

    await emitter.emit("signup", { locale: "en_US" });

    expect(client.lpush).toHaveBeenCalledOnce();
    expect(client.lpush).toHaveBeenCalledWith(
      "metrics:2026-05-07:signup",
      expect.stringContaining("\"locale\":\"en_US\""),
    );
    expect(client.expire).toHaveBeenCalledWith("metrics:2026-05-07:signup", 604800);
  });

  it("does not throw when both sinks fail", async () => {
    const warn = vi.fn();
    const client: KvClient = {
      lpush: vi.fn().mockRejectedValue(new Error("kv down")),
      expire: vi.fn(),
    };
    const emitter = createMetricsEmitter({
      env: {
        NODE_ENV: "production",
        KV_REST_API_URL: "https://kv.example",
        KV_REST_API_TOKEN: "token",
      } as NodeJS.ProcessEnv,
      kvClient: client,
      warn,
      jsonlWriter: vi.fn().mockRejectedValue(new Error("disk down")),
    });

    await expect(emitter.emit("failure", { a: 1 })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
