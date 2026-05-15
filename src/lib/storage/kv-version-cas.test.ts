import { describe, expect, it } from "vitest";
import {
  KvVersionConflictError,
  updateKvVersionedJson,
  type VersionedKvEnvelope,
} from "@/lib/storage/kv-version-cas";

describe("updateKvVersionedJson", () => {
  it("retries when the version changes before the CAS write", async () => {
    let stored: VersionedKvEnvelope<{ value: string }> = {
      version: 1,
      value: { value: "existing" },
      updatedAt: new Date(0).toISOString(),
    };
    let evalCalls = 0;

    const result = await updateKvVersionedJson<{ value: string }>(
      "test:key",
      (_current, currentVersion) => ({ value: `next-${currentVersion + 1}` }),
      {
        client: {
          async get<T>() {
            return stored as T;
          },
          async eval(_script, _keys, args) {
            evalCalls += 1;
            if (evalCalls === 1) {
              stored = {
                version: 2,
                value: { value: "racing-writer" },
                updatedAt: new Date().toISOString(),
              };
              return 0;
            }
            stored = JSON.parse(args[1] ?? "{}") as VersionedKvEnvelope<{ value: string }>;
            return 1;
          },
        },
      },
    );

    expect(evalCalls).toBe(2);
    expect(result.version).toBe(3);
    expect(result.value.value).toBe("next-3");
  });

  it("throws after the retry budget is exhausted", async () => {
    await expect(
      updateKvVersionedJson("test:conflict", () => ({ ok: true }), {
        maxAttempts: 2,
        client: {
          async get() {
            return null;
          },
          async eval() {
            return 0;
          },
        },
      }),
    ).rejects.toBeInstanceOf(KvVersionConflictError);
  });
});
