import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DispatchConsoleV9 } from "../DispatchConsoleV9";
import { isTopicToggleKey } from "../TopicHead";
import { resolveDispatchTabKey } from "../WatchTabs";

describe("DispatchConsoleV9", () => {
  test("renders the v9 tab shell with accessible tab semantics", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-controls="dispatch-panel-flow"');
    expect(html).toContain('aria-controls="dispatch-panel-mkt"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("CLAW 42 · HOW IT WORKS");
  });

  test("renders market topics with the v9 default collapse contract", () => {
    const html = renderToStaticMarkup(<DispatchConsoleV9 initialView="mkt" />);

    expect(html).toContain("BTC live market check");
    expect(html).toContain("ETH live market check");
    expect(html).toContain("SOL live market check");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("topic active");
    expect(html).toContain("topic done collapsed");
    expect(html).toContain("topic pending collapsed");
  });

  test("keeps keyboard helpers deterministic for tabs and topic toggles", () => {
    expect(resolveDispatchTabKey("flow", "ArrowRight")).toBe("mkt");
    expect(resolveDispatchTabKey("mkt", "ArrowRight")).toBe("flow");
    expect(resolveDispatchTabKey("mkt", "ArrowLeft")).toBe("flow");
    expect(resolveDispatchTabKey("flow", "Home")).toBe("flow");
    expect(isTopicToggleKey("Enter")).toBe(true);
    expect(isTopicToggleKey(" ")).toBe(true);
    expect(isTopicToggleKey("Escape")).toBe(false);
  });
});
