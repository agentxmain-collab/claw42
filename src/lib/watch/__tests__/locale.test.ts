import { describe, expect, test } from "vitest";
import { buildLocaleInstruction } from "@/lib/watch/locale";

describe("buildLocaleInstruction", () => {
  test("requires foreign headlines and metric names to be localized", () => {
    expect(buildLocaleInstruction("zh_CN")).toContain("Foreign-language headlines");
    expect(buildLocaleInstruction("zh_CN")).toContain("technical-metric names");
  });
});
