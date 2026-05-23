import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureLandingSessionCookie, generateLandingId } from "../landingId";

describe("landing id", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates addressable UUID landing ids", () => {
    expect(generateLandingId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns null outside the browser", () => {
    vi.stubGlobal("document", undefined);
    expect(ensureLandingSessionCookie()).toBeNull();
  });
});
