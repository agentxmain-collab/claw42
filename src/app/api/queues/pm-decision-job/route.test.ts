import { describe, expect, it, vi } from "vitest";
import { maxDuration } from "./route";

vi.mock("@vercel/queue", () => ({
  handleCallback: vi.fn(() => vi.fn()),
}));

describe("/api/queues/pm-decision-job", () => {
  it("declares enough runtime for queued PM generation", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(300);
  });
});
