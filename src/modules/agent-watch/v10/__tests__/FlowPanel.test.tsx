import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import zhCN from "@/i18n/dicts/zh_CN.json";
import type { Dict } from "@/i18n/types";
import { FlowPanel } from "../FlowPanel";

const dict = (zhCN as Dict).agentWatch.dispatchV10;

describe("FlowPanel v10", () => {
  test("renders six stages with upgraded role titles", () => {
    const html = renderToStaticMarkup(<FlowPanel dict={dict} onGotoMarket={() => undefined} />);

    expect((html.match(/<article class="fstage4/g) ?? []).length).toBe(6);
    expect(html).toContain("基本面研究主管");
    expect(html).toContain("交易策略总监");
    expect(html).toContain("首席投资官");
    expect(html).toContain("策略复盘主管");
    expect(html).toContain("memory_loop.svg");
    expect(html).toContain('class="vs"');
    expect(html).toContain("查看实时 AI 团队工作");
  });
});
