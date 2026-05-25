import { describe, expect, test } from "vitest";
import { validateChatContent } from "@/lib/chatGuardrails";

describe("validateChatContent", () => {
  test("allows concise public analysis text up to 200 characters", () => {
    const result = validateChatContent("稳".repeat(120));

    expect(result.reasons).not.toContain("超过 80 字");
    expect(result.ok).toBe(true);
  });

  test("flags public analysis text above 200 characters", () => {
    const result = validateChatContent("稳".repeat(201));

    expect(result.reasons).toContain("超过 200 字");
    expect(result.ok).toBe(false);
  });
});
