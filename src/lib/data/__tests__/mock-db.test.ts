import { describe, expect, it } from "vitest";
import { quickInsights } from "@/lib/data/mock-db";

describe("mock-db public quick insights", () => {
  it("does not advertise a social dimension without a live social data source", () => {
    const serialized = JSON.stringify(quickInsights);

    expect(quickInsights.map((item) => item.id)).not.toContain("social");
    expect(serialized).not.toContain("社媒");
    expect(serialized.toLowerCase()).not.toContain("social");
  });
});
