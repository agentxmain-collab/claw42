import { describe, expect, it } from "vitest";
import { atomicClaim, markIdempotencyState } from "../kv-idempotency";

describe("KV idempotency helper", () => {
  it("allows one atomic claim and returns the existing record on duplicates", async () => {
    const key = `test:idempotency:${crypto.randomUUID()}`;
    const first = await atomicClaim(key, "request-1", 60);
    const second = await atomicClaim(key, "request-2", 60);

    expect(first).toMatchObject({ claimed: true });
    expect(second).toMatchObject({
      claimed: false,
      existingRecord: {
        requestId: "request-1",
        state: "pending",
      },
    });
  });

  it("updates state in the same idempotency record", async () => {
    const key = `test:idempotency:${crypto.randomUUID()}`;
    await atomicClaim(key, "request-1", 60);
    const sent = await markIdempotencyState(key, "sent", 60);
    const duplicate = await atomicClaim(key, "request-2", 60);

    expect(sent).toMatchObject({ requestId: "request-1", state: "sent" });
    expect(duplicate).toMatchObject({
      claimed: false,
      existingRecord: {
        requestId: "request-1",
        state: "sent",
      },
    });
  });
});
