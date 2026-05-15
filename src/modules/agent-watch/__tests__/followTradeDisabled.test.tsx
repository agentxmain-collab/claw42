import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { DispatchConsoleV9 } from "../v9/DispatchConsoleV9";
import { MarketAnalysisPanel } from "../v10/MarketAnalysisPanel";

const dispatchV10Dict = (zhCN as Dict).agentWatch.dispatchV10;

describe("follow trade disabled safety state", () => {
  test("renders disabled safety copy in the v9 market console", () => {
    const html = renderToStaticMarkup(
      <DispatchConsoleV9 initialView="mkt" followTradeDict={dispatchV10Dict.followTrade} />,
    );

    expect(html).toContain("演示模式");
    expect(html).toContain("不真实下单 · 后续接入授权和风险确认");
    expect(html).toContain('title="演示模式：当前不会真实下单"');
    expect(html).toContain('disabled=""');
  });

  test("renders disabled safety copy in the v10 market panel", () => {
    const html = renderToStaticMarkup(
      <MarketAnalysisPanel dict={dispatchV10Dict} onPlaceholder={() => undefined} />,
    );

    expect(html).toContain("演示模式");
    expect(html).toContain("不真实下单 · 后续接入授权和风险确认");
    expect(html).toContain('title="演示模式：当前不会真实下单"');
    expect(html).toContain('disabled=""');
  });
});
