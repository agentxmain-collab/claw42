import { describe, expect, it } from "vitest";
import { getValidParentOrigin } from "../iframePostMessage";

describe("iframe parent origin validation", () => {
  it.each([
    ["https://www.coinw.com", "https://www.coinw.com"],
    ["https://foo.coinw.com", "https://foo.coinw.com"],
    ["https://badcoinw.com", null],
    ["https://coinw.com", null],
    ["https://coinw.com.evil.com", null],
    ["http://www.coinw.com", null],
    ["https://foo.coinw.com:8443", null],
  ])("validates %s", (referrer, expected) => {
    expect(getValidParentOrigin({ referrer })).toBe(expected);
  });
});
