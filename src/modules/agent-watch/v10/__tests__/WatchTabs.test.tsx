import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { resolveDispatchV10TabKey, WatchTabs } from "../WatchTabs";

describe("WatchTabs v10", () => {
  test("keeps tab labels, live badge, and accessible state", () => {
    const html = renderToStaticMarkup(
      <WatchTabs
        activeView="flow"
        flowLabel="流程介绍"
        marketLabel="行情分析"
        liveLabel="LIVE"
        onViewChange={() => undefined}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-controls="dispatch-v10-panel-flow"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("流程介绍");
    expect(html).toContain("行情分析");
    expect(html).toContain("LIVE");
  });

  test("keeps keyboard tab resolution deterministic", () => {
    expect(resolveDispatchV10TabKey("flow", "ArrowRight")).toBe("mkt");
    expect(resolveDispatchV10TabKey("mkt", "ArrowLeft")).toBe("flow");
    expect(resolveDispatchV10TabKey("mkt", "Home")).toBe("flow");
    expect(resolveDispatchV10TabKey("flow", "End")).toBe("mkt");
    expect(resolveDispatchV10TabKey("flow", "Escape")).toBe("flow");
  });
});
