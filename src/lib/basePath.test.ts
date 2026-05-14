import { describe, expect, it } from "vitest";
import { normalizeBasePath } from "./basePath";

describe("normalizeBasePath", () => {
  it("keeps root deployment empty", () => {
    expect(normalizeBasePath(undefined)).toBe("");
    expect(normalizeBasePath("")).toBe("");
    expect(normalizeBasePath("/")).toBe("");
  });

  it("normalizes path deployments with one leading slash and no trailing slash", () => {
    expect(normalizeBasePath("claw42")).toBe("/claw42");
    expect(normalizeBasePath("/claw42/")).toBe("/claw42");
    expect(normalizeBasePath("///claw42///")).toBe("/claw42");
  });
});
