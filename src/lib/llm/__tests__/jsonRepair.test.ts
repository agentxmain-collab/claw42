import { describe, expect, it } from "vitest";
import { parseJsonObjectWithRepair } from "@/lib/llm/jsonRepair";

describe("parseJsonObjectWithRepair", () => {
  it("repairs a JSON object truncated after a numeric field", () => {
    const parsed = parseJsonObjectWithRepair(
      '{"rationale":"Market breadth is mixed but BTC support is intact","confidence":0.58',
    );

    expect(parsed).toEqual({
      rationale: "Market breadth is mixed but BTC support is intact",
      confidence: 0.58,
    });
  });

  it("repairs a JSON object truncated inside a string field", () => {
    const parsed = parseJsonObjectWithRepair(
      '{"rationale":"BTC holds the range while ETH momentum softens',
    );

    expect(parsed).toEqual({
      rationale: "BTC holds the range while ETH momentum softens",
    });
  });

  it("still rejects non-object JSON after repair attempts", () => {
    expect(() => parseJsonObjectWithRepair('["not","object"]')).toThrow(
      "LLM output must be a JSON object",
    );
  });
});
